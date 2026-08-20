/**
 * Een zip die schrijft terwijl hij leest.
 *
 * "Alles downloaden" mag niet betekenen dat de server eerst vijf video's in het
 * geheugen legt om er daarna een bestand van te maken. Deze module schrijft het
 * archief als stroom: per bestand een kopregel, dan de bytes die binnenkomen
 * meteen weer naar buiten, en op het eind de inhoudsopgave. De browser begint
 * dus te downloaden voor de laatste video zelfs maar geopend is.
 *
 * Twee keuzes die daaruit volgen:
 *
 * - **Geen compressie** (methode `store`). Een MP4 is al gecomprimeerd; er nog
 *   eens deflate overheen halen kost processortijd en levert procenten op.
 * - **Groottes achteraf** (de *data descriptor*). Wie streamt, weet de CRC en
 *   de lengte pas nadat het bestand voorbij is; de zipspecificatie voorziet
 *   daar een vlag voor, en elke uitpakker van deze eeuw kent ze.
 *
 * Wat hier bewust niet in zit, is zip64. Dat betekent: geen enkel bestand boven
 * 4 GiB en geen archief boven 4 GiB. Een pandvideo van een paar minuten zit
 * daar met factoren onder, en de grens wordt hieronder gecontroleerd in plaats
 * van gehoopt — een archief dat stilletjes stuk gaat, is erger dan een
 * download die eerlijk afbreekt.
 */

export type ZipEntry = {
  /** De naam in het archief; mag mappen bevatten met `/`. */
  name: string;
  /** Pas openen wanneer dit bestand aan de beurt is, niet allemaal tegelijk. */
  open: () => Promise<ReadableStream<Uint8Array>>;
  /** Wat er in de zip als wijzigingsdatum komt te staan. */
  modifiedAt?: Date;
};

/** De grens van een zip zonder zip64: 4 GiB min één byte. */
const MAX_ZIP_SIZE = 0xffff_ffff;

const LOCAL_FILE_HEADER = 0x0403_4b50;
const DATA_DESCRIPTOR = 0x0807_4b50;
const CENTRAL_DIRECTORY = 0x0201_4b50;
const END_OF_CENTRAL_DIRECTORY = 0x0605_4b50;

/** Opslaan zonder comprimeren. */
const METHOD_STORE = 0;

/**
 * Bit 3: groottes en CRC staan achter het bestand in plaats van ervoor.
 * Bit 11: de naam is UTF-8.
 */
const FLAG_DATA_DESCRIPTOR = 0x0008;
const FLAG_UTF8 = 0x0800;

/** Wat de uitpakker minstens moet kennen: 2.0, want data descriptors. */
const VERSION_NEEDED = 20;

export class ZipTooLargeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ZipTooLargeError";
  }
}

/** Eén rij in de inhoudsopgave, ingevuld terwijl het bestand voorbijkomt. */
type CentralRecord = {
  name: Uint8Array;
  crc: number;
  size: number;
  offset: number;
  dosTime: number;
  dosDate: number;
};

/**
 * Het archief als stroom. De bestanden gaan er één voor één in, in de volgorde
 * waarin ze meegegeven zijn.
 *
 * Loopt er onderweg iets mis — een bestand dat uit de opslag verdwenen is — dan
 * breekt de stroom af met een fout. De browser ziet dan een mislukte download
 * in plaats van een zip die zich niet laat openen, en dat is de eerlijkste van
 * de twee.
 */
export function createZipStream(entries: readonly ZipEntry[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const records: CentralRecord[] = [];

  /** Het bestand dat nu voorbijkomt; `null` tussen twee bestanden in. */
  let current: OpenEntry | null = null;
  let offset = 0;
  let index = 0;

  return new ReadableStream<Uint8Array>({
    /**
     * Per beurt hoogstens één stuk. Dat is wat de rem erop houdt: `pull` komt
     * pas terug als de browser de vorige bytes heeft aangenomen, dus een trage
     * verbinding laat de video niet in het serverheugen oplopen.
     */
    async pull(controller) {
      const push = (chunk: Uint8Array): void => {
        offset += chunk.byteLength;

        if (offset > MAX_ZIP_SIZE) {
          throw new ZipTooLargeError("Dit archief past niet in een gewone zip (meer dan 4 GB).");
        }

        controller.enqueue(chunk);
      };

      if (current) {
        const { done, value } = await current.reader.read();

        if (done) {
          push(dataDescriptor(current.crc, current.size));
          records.push({
            name: current.name,
            crc: current.crc,
            size: current.size,
            offset: current.offset,
            dosTime: current.dosTime,
            dosDate: current.dosDate,
          });
          current = null;

          return;
        }

        if (!value || value.byteLength === 0) return;

        current.crc = crc32(value, current.crc);
        current.size += value.byteLength;

        if (current.size > MAX_ZIP_SIZE) {
          throw new ZipTooLargeError(
            `"${current.label}" is te groot voor een gewone zip (meer dan 4 GB).`,
          );
        }

        push(value);

        return;
      }

      if (index < entries.length) {
        const entry = entries[index]!;
        index += 1;

        const name = encoder.encode(entry.name);
        const { dosTime, dosDate } = toDosDateTime(entry.modifiedAt ?? new Date());
        const headerOffset = offset;

        // Openen gebeurt hier en niet vooraf: pas als dit bestand aan de beurt
        // is, wordt er een verbinding met de opslag gelegd.
        const reader = (await entry.open()).getReader();

        push(localFileHeader(name, dosTime, dosDate));
        current = {
          label: entry.name,
          name,
          reader,
          crc: 0,
          size: 0,
          offset: headerOffset,
          dosTime,
          dosDate,
        };

        return;
      }

      // Alle bestanden zijn voorbij; nu pas weten we waar ze staan.
      const directoryOffset = offset;

      for (const record of records) push(centralDirectoryEntry(record));

      push(endOfCentralDirectory(records.length, offset - directoryOffset, directoryOffset));
      controller.close();
    },

    /** De browser breekt de download af: dan stopt ook wat we uit de opslag lezen. */
    async cancel(reason) {
      await current?.reader.cancel(reason);
      current = null;
    },
  });
}

/** Wat we van het huidige bestand bijhouden terwijl het voorbijkomt. */
type OpenEntry = {
  /** De naam zoals ze in een foutmelding leesbaar is. */
  label: string;
  name: Uint8Array;
  reader: ReadableStreamDefaultReader<Uint8Array>;
  crc: number;
  size: number;
  /** Waar de kopregel van dit bestand in het archief begon. */
  offset: number;
  dosTime: number;
  dosDate: number;
};

function localFileHeader(name: Uint8Array, dosTime: number, dosDate: number): Uint8Array {
  const header = new Uint8Array(30 + name.byteLength);
  const view = new DataView(header.buffer);

  view.setUint32(0, LOCAL_FILE_HEADER, true);
  view.setUint16(4, VERSION_NEEDED, true);
  view.setUint16(6, FLAG_DATA_DESCRIPTOR | FLAG_UTF8, true);
  view.setUint16(8, METHOD_STORE, true);
  view.setUint16(10, dosTime, true);
  view.setUint16(12, dosDate, true);
  // CRC en groottes zijn hier nog onbekend; ze staan straks in de descriptor.
  view.setUint32(14, 0, true);
  view.setUint32(18, 0, true);
  view.setUint32(22, 0, true);
  view.setUint16(26, name.byteLength, true);
  view.setUint16(28, 0, true);
  header.set(name, 30);

  return header;
}

function dataDescriptor(crc: number, size: number): Uint8Array {
  const descriptor = new Uint8Array(16);
  const view = new DataView(descriptor.buffer);

  view.setUint32(0, DATA_DESCRIPTOR, true);
  view.setUint32(4, crc, true);
  // Zonder compressie zijn de twee groottes dezelfde.
  view.setUint32(8, size, true);
  view.setUint32(12, size, true);

  return descriptor;
}

function centralDirectoryEntry(record: CentralRecord): Uint8Array {
  const entry = new Uint8Array(46 + record.name.byteLength);
  const view = new DataView(entry.buffer);

  view.setUint32(0, CENTRAL_DIRECTORY, true);
  // Gemaakt door versie 2.0 op een "MS-DOS"-systeem: de neutrale keuze, want
  // we schrijven geen rechten mee.
  view.setUint16(4, VERSION_NEEDED, true);
  view.setUint16(6, VERSION_NEEDED, true);
  view.setUint16(8, FLAG_DATA_DESCRIPTOR | FLAG_UTF8, true);
  view.setUint16(10, METHOD_STORE, true);
  view.setUint16(12, record.dosTime, true);
  view.setUint16(14, record.dosDate, true);
  view.setUint32(16, record.crc, true);
  view.setUint32(20, record.size, true);
  view.setUint32(24, record.size, true);
  view.setUint16(28, record.name.byteLength, true);
  view.setUint16(30, 0, true);
  view.setUint16(32, 0, true);
  view.setUint16(34, 0, true);
  view.setUint16(36, 0, true);
  view.setUint32(38, 0, true);
  view.setUint32(42, record.offset, true);
  entry.set(record.name, 46);

  return entry;
}

function endOfCentralDirectory(count: number, size: number, offset: number): Uint8Array {
  const end = new Uint8Array(22);
  const view = new DataView(end.buffer);

  view.setUint32(0, END_OF_CENTRAL_DIRECTORY, true);
  view.setUint16(4, 0, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, count, true);
  view.setUint16(10, count, true);
  view.setUint32(12, size, true);
  view.setUint32(16, offset, true);
  view.setUint16(20, 0, true);

  return end;
}

/**
 * De datum zoals MS-DOS ze bewaarde: jaren sinds 1980, seconden per twee.
 * Ouder dan 1980 bestaat niet in een zip, dus daar knippen we op af.
 */
function toDosDateTime(date: Date): { dosTime: number; dosDate: number } {
  const year = Math.max(date.getFullYear(), 1980);

  return {
    dosTime:
      (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    dosDate: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

/**
 * De tabel voor CRC-32 (het polynoom van de zipspecificatie). Eén keer opgebouwd
 * bij het laden van de module; per byte opnieuw rekenen is voor een video van
 * honderden megabytes het verschil tussen merkbaar en niet.
 */
const CRC_TABLE = buildCrcTable();

function buildCrcTable(): Uint32Array {
  const table = new Uint32Array(256);

  for (let index = 0; index < 256; index += 1) {
    let value = index;

    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb8_8320 ^ (value >>> 1) : value >>> 1;
    }

    table[index] = value >>> 0;
  }

  return table;
}

/** De CRC van een stuk, verder rekenend op wat er al voorbij is. */
export function crc32(chunk: Uint8Array, previous = 0): number {
  let crc = ~previous;

  for (let index = 0; index < chunk.length; index += 1) {
    crc = CRC_TABLE[(crc ^ chunk[index]!) & 0xff]! ^ (crc >>> 8);
  }

  return ~crc >>> 0;
}

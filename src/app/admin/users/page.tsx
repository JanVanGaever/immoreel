import type { Metadata } from "next";
import Link from "next/link";
import { CellStack, DataTable, FilterBar, Identifier, Pagination } from "@/components/admin";
import type { DataTableColumn } from "@/components/admin";
import { PageHeader } from "@/components/layout/page-header";
import { RoleBadge } from "@/components/team/role-badge";
import { Badge } from "@/components/ui/badge";
import { getAdminStore } from "@/db/admin-store";
import { ADMIN_PARAMS, parseUserQuery, type AdminSearchParams } from "@/lib/admin/query";
import { ADMIN_ROUTES } from "@/lib/admin/routes";
import { ROLES, ROLE_LABELS } from "@/lib/auth/roles";
import { formatDate } from "@/lib/format";
import type { AdminUserRow } from "@/types";

export const metadata: Metadata = { title: "Gebruikers" };
export const dynamic = "force-dynamic";

/**
 * Wie belt er?
 *
 * Zoeken gaat ook op id, want een supportvraag komt vaak binnen mét een id uit
 * een foutmelding en zonder een naam die klopt. De twee kolommen die er echt
 * toe doen staan naast het adres: is het bevestigd, en is er een wachtwoord —
 * samen verklaren die het gros van "ik raak niet binnen".
 */
export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<AdminSearchParams>;
}) {
  const params = await searchParams;
  const query = parseUserQuery(params);
  const result = await getAdminStore().listUsers(query);

  const columns: DataTableColumn<AdminUserRow>[] = [
    {
      key: "user",
      header: "Gebruiker",
      cell: (row) => <CellStack title={row.name} subtitle={row.email} />,
    },
    {
      key: "organisation",
      header: "Kantoor",
      cell: (row) =>
        row.organisation ? (
          <Link
            href={ADMIN_ROUTES.organisation(row.organisation.id)}
            className="underline-offset-2 hover:underline"
          >
            {row.organisation.name}
          </Link>
        ) : (
          <Badge variant="warning" size="sm" title="Zonder lidmaatschap komt deze gebruiker nergens binnen.">
            Geen lidmaatschap
          </Badge>
        ),
    },
    {
      key: "role",
      header: "Rol",
      cell: (row) => (row.role ? <RoleBadge role={row.role} /> : <span className="text-fg-subtle">—</span>),
    },
    {
      key: "verified",
      header: "E-mail",
      cell: (row) =>
        row.emailVerifiedAt ? (
          <span className="text-sm text-fg-muted">Bevestigd {formatDate(row.emailVerifiedAt)}</span>
        ) : (
          <Badge variant="warning" size="sm">
            Niet bevestigd
          </Badge>
        ),
    },
    {
      key: "password",
      header: "Wachtwoord",
      cell: (row) =>
        row.hasPassword ? (
          <span className="text-sm text-fg-muted">Ingesteld</span>
        ) : (
          <Badge variant="info" size="sm" title="Deze gebruiker logt in via een magic link of een uitnodiging.">
            Alleen magic link
          </Badge>
        ),
    },
    {
      key: "created",
      header: "Aangemaakt",
      align: "right",
      cell: (row) => <span className="text-sm text-fg-muted">{formatDate(row.createdAt)}</span>,
    },
    {
      key: "id",
      header: "Id",
      cell: (row) => <Identifier value={row.id} />,
    },
  ];

  return (
    <>
      <PageHeader
        title="Gebruikers"
        description="Zoek op naam, e-mailadres of gebruikers-id. De id werkt ook als de naam niet klopt."
      />

      <FilterBar
        action={ADMIN_ROUTES.users}
        search={query.search}
        searchPlaceholder="Naam, e-mailadres of usr_..."
        isFiltered={Boolean(query.search || query.role || query.organisationId)}
        hidden={query.organisationId ? { [ADMIN_PARAMS.organisation]: query.organisationId } : {}}
        selects={[
          {
            name: ADMIN_PARAMS.role,
            label: "Rol",
            value: query.role ?? "",
            options: [
              { value: "", label: "Alle rollen" },
              ...ROLES.map((role) => ({ value: role, label: ROLE_LABELS[role] })),
            ],
          },
        ]}
      />

      <DataTable
        rows={result.items}
        columns={columns}
        getKey={(row) => row.id}
        empty="Geen gebruikers gevonden. Pas de zoekopdracht aan of wis de filters."
      />

      <Pagination
        result={result}
        pathname={ADMIN_ROUTES.users}
        params={params}
        label="gebruikers"
      />
    </>
  );
}

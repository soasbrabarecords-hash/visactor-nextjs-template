-- Generated contracts are operational records: archive or cancel them, never delete them.
drop policy if exists label_contracts_workspace_delete on public.label_contracts;

revoke update, delete on public.label_contracts from authenticated;
grant update (
  status,
  signed_pdf_path,
  signed_file_name,
  sent_at,
  signed_at,
  expires_at,
  cancelled_at
) on public.label_contracts to authenticated;

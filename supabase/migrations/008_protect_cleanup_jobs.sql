-- Only the cleanup RPC may complete a queued deletion. Direct table deletes
-- could otherwise abandon encrypted Storage objects and their quota usage.
revoke delete on public.pending_journal_asset_deletions from public, anon, authenticated;
drop policy if exists "remove own pending asset deletions" on public.pending_journal_asset_deletions;

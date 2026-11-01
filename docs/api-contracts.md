# API contracts

## Listing videos (Supabase)

Storage bucket `listing-videos` (public read). Files live at `<listing_id>/<uuid>.<ext>`; posters at `<listing_id>/<uuid>.jpg`. Allowed types: `video/mp4`, `video/webm`, `video/quicktime`, `image/jpeg`.

Table `listing_videos`: `id, listing_id, url, position, source ('upload'|'link'), storage_path, poster_url, width, height, duration_seconds, aspect_ratio, orientation, mime_type, file_size_bytes, provider, embed_url, status ('ready'|'processing'|'rejected'), created_by`. Non-ready rows are visible only to the seller, their team and admins.

| RPC | Caller | Purpose |
| --- | --- | --- |
| `save_listing_video(p_listing_id, p_source, p_url, p_storage_path, p_meta)` | seller, team member, admin | Validates ownership, block flag, https, the real file size and type from storage, and the length limit, then appends the row. The plan limit is enforced by the `enforce_listing_video_limit` trigger. |
| `delete_listing_video(p_video_id)` | seller, team member, admin | Deletes the row, logs it and returns `{storage_path, poster_path}`. The client then removes the files. |
| `set_listing_video_ratio(p_video_id, p_width, p_height)` | owner, admin | Sets the ratio once when it is missing. |
| `admin_review_listing_video(p_video_id, p_approve)` | admin | Approves or rejects a video held for review. |
| `admin_video_storage_stats()` | admin | Counts of uploads, links, bytes and videos awaiting review. |
| `admin_list_orphan_videos()` | admin | Dry-run list of stored files with no row, older than 24 h. |

Error codes raised: `VIDEO_AUTH_REQUIRED`, `VIDEO_LISTING_ACCESS_DENIED`, `VIDEO_WALKTHROUGH_BLOCKED`, `VIDEO_LIMIT_REACHED`, `VIDEO_URL_MUST_BE_HTTPS`, `VIDEO_FILE_MISSING`, `VIDEO_BAD_TYPE`, `VIDEO_TOO_LARGE`, `VIDEO_TOO_LONG`.

Settings (`platform_settings`): `video_max_seconds` (60), `video_max_mb` (50), `video_requires_review` (0). Plan limits per listing come from `plan_unlocks` key `video_slots`.

Realtime: `listing_videos` is in the `supabase_realtime` publication. Only owners, admins and the Manage videos modal subscribe.

Deleting a listing removes its rows through the foreign key. The dashboard and admin then call `NKVideo.purgeListingFiles` to remove the stored files.

## Plans and unlocks

`plan_unlocks (feature_key, label, kind 'bool'|'number', free_value, premium_value, elite_value, sort, active)`.

| RPC | Caller | Purpose |
| --- | --- | --- |
| `get_public_plan_matrix()` | anyone | Active rows for the comparison table on `/plans`. |
| `admin_save_plan_unlocks(p_rows)` | admin | Updates the `free`, `premium` and `elite` values per `key` and logs the change. |
| `nk_plan_unlock(plan, key)` | server | Value lookup used by triggers such as the video limit. |

Listing price mode: `platform_settings.listing_fee_mode` is `single` or `per_category`. An active Premium or Elite subscription covers every category.

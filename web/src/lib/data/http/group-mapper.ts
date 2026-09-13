import { V1Group } from '../../api/models/v1group';
import { UserGroup } from '../../../app/shared/models';

/**
 * Maps a V1Group (proto/API response) to the frontend UserGroup model.
 */
export function mapV1Group(g: V1Group): UserGroup {
  return {
    id: g.uid ?? '',
    customId: extractCustomId(g.name),
    name: g.display_name ?? '',
    description: g.display_description ?? null,
    isSystem: g.is_system ?? false,
    organizations: g.organizations ?? [],
    permissions: g.permissions ?? [],
    createdAt: g.create_time ? new Date(g.create_time) : new Date(),
    updatedAt: g.update_time ? new Date(g.update_time) : new Date(),
  };
}

/**
 * Extracts the custom ID from a group resource name "groups/{customId}".
 */
export function extractCustomId(name: string | undefined): string {
  if (!name) return '';
  const parts = name.split('/');
  return parts.length >= 2 ? parts[parts.length - 1] : name;
}

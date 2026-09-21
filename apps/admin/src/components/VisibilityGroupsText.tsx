import { useMemo, useState } from "react";

import { Modal } from "./Modal";

interface GroupOption {
  id: string;
  name: string;
}

interface ProductVisibility {
  scope: "all_groups" | "specified_groups";
  groupIds?: string[];
}

interface VisibilityGroupsTextProps {
  groups: GroupOption[];
  visibility: ProductVisibility;
}

export function VisibilityGroupsText({
  groups,
  visibility,
}: VisibilityGroupsTextProps) {
  const [open, setOpen] = useState(false);
  const visibleGroups = useMemo(() => {
    if (visibility.scope !== "specified_groups") {
      return [];
    }
    return visibility.groupIds?.map((groupId) => {
      const group = groups.find(({ id }) => id === groupId);
      return {
        id: groupId,
        name: group?.name ?? `未知集团（${groupId}）`,
      };
    }) ?? [];
  }, [groups, visibility]);

  if (visibility.scope === "all_groups") {
    return <span>全部集团</span>;
  }

  return (
    <>
      <button
        className="inline-text-button"
        onClick={() => setOpen(true)}
        type="button"
      >
        {visibleGroups.length} 个指定集团
      </button>
      <Modal
        footer={
          <button
            className="button button--secondary"
            onClick={() => setOpen(false)}
            type="button"
          >
            关闭
          </button>
        }
        onClose={() => setOpen(false)}
        open={open}
        title="指定可见集团"
      >
        {visibleGroups.length > 0 ? (
          <ul className="simple-list">
            {visibleGroups.map((group) => (
              <li key={group.id}>{group.name}</li>
            ))}
          </ul>
        ) : (
          <p className="empty-hint">暂未选择指定集团。</p>
        )}
      </Modal>
    </>
  );
}

import type { PlatformData } from "@travel/domain";

export interface PlatformRepository {
  getSnapshot(): PlatformData;
  update<TResult>(mutation: (draft: PlatformData) => TResult): TResult;
}

/**
 * 原型阶段使用的同步内存仓储。
 *
 * 每次读取和写入都使用结构化克隆，避免调用方绕过业务服务直接修改数据。
 */
export class InMemoryPlatformRepository implements PlatformRepository {
  private data: PlatformData;

  constructor(initialData: PlatformData) {
    this.data = structuredClone(initialData);
  }

  getSnapshot(): PlatformData {
    return structuredClone(this.data);
  }

  update<TResult>(mutation: (draft: PlatformData) => TResult): TResult {
    const draft = structuredClone(this.data);
    const result = mutation(draft);

    this.data = draft;

    return structuredClone(result);
  }
}

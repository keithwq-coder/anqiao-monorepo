/** 业主待填字段的统一标记值。SPEC §8.1：数据层统一用该字符串，严禁填充编造内容。 */
export const PENDING = "{{待填}}";

/** 判定一个字段是否处于待填状态（用于决定是否渲染 <Pending />）。 */
export function isPending(value: string | null | undefined): boolean {
  if (value === null || value === undefined) return true;
  return value.trim() === "" || value.trim() === PENDING;
}

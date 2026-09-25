// src/lib/courseware.ts — 课件内容加载（版本化文件，不入库）
import cwJson from "@/content/courseware.json";

export interface Slide {
  title: string;
  type: string;
  label?: string;
  lines?: string[];
  items?: string[];
  headers?: string[];
  rows?: string[][];
  left_title?: string;
  left?: string[];
  right_title?: string;
  right?: string[];
  text?: string;
}

export interface CoursewareModule {
  id: string;
  title: string;
  layer?: string;
  duration?: string;
  slides: Slide[];
}

const cw = cwJson as CoursewareModule[];

const byId = new Map(cw.map((m) => [m.id, m]));

export function getCourseware(): CoursewareModule[] {
  return cw;
}

export function getModuleContent(id: string): CoursewareModule | null {
  return byId.get(id) ?? null;
}

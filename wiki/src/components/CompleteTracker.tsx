"use client";

// 课件页"滚动到底即标记已学完"（仅档案记录，不构成认证门槛；不重复提交）
// T-C：不再挂载即判定；仅当页面真实可滚动且滚动到底才自动标记；短课件（不可滚动）不自动标记
import { useEffect, useRef } from "react";

export default function CompleteTracker({ moduleId }: { moduleId: string }) {
  const fired = useRef(false);

  useEffect(() => {
    function onScroll() {
      if (fired.current) return;
      // 页面真实可滚动（内容高度 > 视口 + 120px）才考虑自动标记
      const scrollable =
        document.documentElement.scrollHeight > window.innerHeight + 120;
      if (!scrollable) return;
      // 距底 < 120px 视为看完
      const nearBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 120;
      if (!nearBottom) return;
      fired.current = true;
      fetch(`/api/course/${moduleId}/complete`, { method: "POST" }).catch(() => {
        fired.current = false; // 网络失败可重试
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    // 不主动调用 onScroll()：避免挂载即判定导致"打开即完成"
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [moduleId]);

  return null;
}

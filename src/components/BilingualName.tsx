import { bilingualLabel, nameRepeats } from "@/lib/format";
import { cn } from "@/lib/utils";

/** 物料和类别名。英文已包含在中文里时只显示一次，否则英文单独排成浅色第二行。 */
export function BilingualName({
  nameZh,
  nameEn,
  className,
}: {
  nameZh: string;
  nameEn: string;
  className?: string;
}) {
  const zh = nameZh.trim();
  const en = nameEn.trim();
  if (!zh || !en || nameRepeats(zh, en)) {
    return <span className={cn("break-words", className)}>{bilingualLabel(zh, en)}</span>;
  }
  return (
    <span className={cn("break-words", className)}>
      <span className="block break-words">{zh}</span>
      <span className="block break-words text-xs font-normal leading-4 text-muted-foreground">{en}</span>
    </span>
  );
}

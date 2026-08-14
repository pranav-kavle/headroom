import Link from "next/link";
import type { ReactNode } from "react";
import { ASSISTANT_NAME } from "@/lib/assistant";
import { OttoMark } from "./OttoMark";
import styles from "./OttoNote.module.css";

/**
 * Otto speaking on a screen that has nothing to show yet. Violet, because in
 * this design violet means the assistant did something — including telling you
 * honestly that it hasn't.
 */
export function OttoNote({
  children,
  action,
}: {
  children: ReactNode;
  action?: { label: string; href: string };
}) {
  return (
    <div className={styles.note}>
      <div className={styles.head}>
        <OttoMark size="sm" />
        {ASSISTANT_NAME}
      </div>
      <p className={styles.body}>{children}</p>
      {action && (
        <Link href={action.href} className={styles.action}>
          {action.label}
        </Link>
      )}
    </div>
  );
}

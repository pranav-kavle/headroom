import styles from "./Landing.module.css";
import { ShieldIcon, FileIcon, DocIcon } from "./icons";

export function TrustBar() {
  return (
    <div className={styles.lpTrust}>
      <div className={styles.lpInner}>
        <div className={styles.trustItem}>
          <ShieldIcon />
          <div>
            <div className={styles.tk}>Reads your data. Recommends only.</div>
            <div className={styles.tv}>It watches the accounts and advises. It never moves a dollar.</div>
          </div>
        </div>
        <div className={styles.trustItem}>
          <FileIcon />
          <div>
            <div className={styles.tk}>Built for Schedule C.</div>
            <div className={styles.tv}>Sole-proprietor freelancers with lumpy, unpredictable income.</div>
          </div>
        </div>
        <div className={styles.trustItem}>
          <DocIcon />
          <div>
            <div className={styles.tk}>Estimates you can take to your accountant.</div>
            <div className={styles.tv}>Every figure is a range with its assumption stated — the low end is the promise.</div>
          </div>
        </div>
      </div>
    </div>
  );
}

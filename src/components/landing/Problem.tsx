import styles from "./Landing.module.css";

export function Problem() {
  return (
    <div className={styles.lpSec}>
      <div className={styles.lpInner}>
        <div className={styles.secEyebrow}>The problem</div>
        <h2 className="serif">Your commitments are scattered across five apps. Your capacity lives in none of them.</h2>
        <p className={styles.lead}>
          You promised a review in a PR comment, a doc by Thursday in the fourth paragraph
          of an email thread, and a call back to someone while you were out walking. Each
          app knows its own slice; none of them knows your week. So the thing that slips is
          never the thing you were tracking — <b>it&rsquo;s the promise you made in prose
          three Tuesdays ago</b> and never wrote down anywhere.
        </p>
      </div>
    </div>
  );
}

import styles from "./VoiceSheet.module.css";

export function VoiceSheet({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <button type="button" className={styles.scrim} aria-label="Close voice capture" onClick={onClose} />
      <div className={styles.sheet}>
        <div className={styles.grab} />
        {children}
      </div>
    </>
  );
}

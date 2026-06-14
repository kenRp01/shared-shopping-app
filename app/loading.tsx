export default function Loading() {
  return (
    <div className="page-grid redirect-shell" aria-busy="true" aria-live="polite">
      <div className="redirect-loader" aria-label="リストを開いています" role="status" />
    </div>
  );
}

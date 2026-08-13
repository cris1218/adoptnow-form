export function PawMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <ellipse cx="18" cy="18" rx="8" ry="10" fill="currentColor" />
      <ellipse cx="32" cy="12" rx="8" ry="10" fill="currentColor" />
      <ellipse cx="46" cy="18" rx="8" ry="10" fill="currentColor" />
      <ellipse cx="14" cy="34" rx="7" ry="9" fill="currentColor" />
      <path
        d="M32 28c-10 0-18 8.5-18 18 0 6 5 10 11 10 3.2 0 6-1.2 7-3.2 1 2 3.8 3.2 7 3.2 6 0 11-4 11-10 0-9.5-8-18-18-18Z"
        fill="currentColor"
      />
    </svg>
  );
}

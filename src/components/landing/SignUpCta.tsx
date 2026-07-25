"use client";

import { SignUpButton } from "@clerk/nextjs";

export function SignUpCta({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <SignUpButton mode="modal">
      <button className={className}>{children}</button>
    </SignUpButton>
  );
}

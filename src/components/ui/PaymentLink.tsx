"use client";

import React from "react";
import { buttonVariants } from "./button";
import Link from "next/link";

type PaymentLinkProps = {
  href: string;
  text: string;
  paymentLink?: string;
};
const PaymentLink = ({ href, text, paymentLink }: PaymentLinkProps) => {
  return (
    <Link
      href={href}
      className={buttonVariants()}
      onClick={() => {
        if (paymentLink) {
          localStorage.setItem("stripePaymentLink", paymentLink);
        }
      }}
    >
      {text}
    </Link>
  );
};

export default PaymentLink;

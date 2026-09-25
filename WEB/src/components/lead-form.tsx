"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { submitLead } from "@/actions/submit-lead";
import {
  CUSTOMER_TYPES,
  EMPTY_LEAD_STATE,
  INQUIRY_TYPES,
  LIMITS,
  type LeadType,
} from "@/lib/lead";

const LABEL = "block text-sm font-medium text-text";
const INPUT =
  "focus-ring mt-2 block w-full rounded-md border border-border bg-white px-3 py-2 text-text";
const ERROR = "mt-1 text-sm text-[#B4342C]";

export function LeadForm({
  type,
  defaultProduct = "",
  defaultInquiryType = "",
}: {
  type: LeadType;
  defaultProduct?: string;
  defaultInquiryType?: string;
}) {
  const tf = useTranslations("form");

  const [state, formAction, pending] = useActionState(
    submitLead,
    EMPTY_LEAD_STATE,
  );

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <input type="hidden" name="type" value={type} />

      <div>
        <label htmlFor="lead-name" className={LABEL}>
          {tf("name")} <span aria-hidden="true">*</span>
        </label>
        <input
          id="lead-name"
          name="name"
          type="text"
          required
          maxLength={LIMITS.name}
          aria-describedby={state.errors.name ? "err-name" : undefined}
          className={INPUT}
        />
        {state.errors.name ? (
          <p id="err-name" className={ERROR}>
            {state.errors.name}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="lead-phone" className={LABEL}>
          {tf("phone")} <span aria-hidden="true">*</span>
        </label>
        <input
          id="lead-phone"
          name="phone"
          type="tel"
          required
          maxLength={LIMITS.phone}
          aria-describedby={state.errors.phone ? "err-phone" : undefined}
          className={INPUT}
        />
        {state.errors.phone ? (
          <p id="err-phone" className={ERROR}>
            {state.errors.phone}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="lead-organization" className={LABEL}>
          {tf("organization")} <span aria-hidden="true">*</span>
        </label>
        <input
          id="lead-organization"
          name="organization"
          type="text"
          required
          maxLength={LIMITS.organization}
          aria-describedby={
            state.errors.organization ? "err-organization" : undefined
          }
          className={INPUT}
        />
        {state.errors.organization ? (
          <p id="err-organization" className={ERROR}>
            {state.errors.organization}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="lead-inquiry-type" className={LABEL}>
          {tf("inquiryType")} <span aria-hidden="true">*</span>
        </label>
        <select
          id="lead-inquiry-type"
          name="inquiryType"
          required
          defaultValue={defaultInquiryType}
          aria-describedby={
            state.errors.inquiryType ? "err-inquiry-type" : undefined
          }
          className={INPUT}
        >
          <option value="">{tf("select")}</option>
          {INQUIRY_TYPES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        {state.errors.inquiryType ? (
          <p id="err-inquiry-type" className={ERROR}>
            {state.errors.inquiryType}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="lead-customer-type" className={LABEL}>
          {tf("customerType")}
        </label>
        <select
          id="lead-customer-type"
          name="customerType"
          defaultValue=""
          aria-describedby={
            state.errors.customerType ? "err-customer-type" : undefined
          }
          className={INPUT}
        >
          <option value="">{tf("selectOptional")}</option>
          {CUSTOMER_TYPES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        {state.errors.customerType ? (
          <p id="err-customer-type" className={ERROR}>
            {state.errors.customerType}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="lead-product" className={LABEL}>
          {tf("product")}
        </label>
        <input
          id="lead-product"
          name="product"
          type="text"
          maxLength={LIMITS.product}
          defaultValue={defaultProduct}
          aria-describedby={state.errors.product ? "err-product" : undefined}
          className={INPUT}
        />
        {state.errors.product ? (
          <p id="err-product" className={ERROR}>
            {state.errors.product}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="lead-message" className={LABEL}>
          {tf("message")}
        </label>
        <textarea
          id="lead-message"
          name="message"
          rows={4}
          maxLength={LIMITS.message}
          aria-describedby={state.errors.message ? "err-message" : undefined}
          className={INPUT}
        />
        {state.errors.message ? (
          <p id="err-message" className={ERROR}>
            {state.errors.message}
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="focus-ring inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-60"
      >
        {pending ? tf("submitting") : tf("submit")}
      </button>

      <p aria-live="polite" role="status">
        {state.ok ? (
          <span className="block rounded-md bg-primary-light px-4 py-3 text-primary-dark">
            {state.message}
          </span>
        ) : state.message ? (
          <span className={ERROR}>{state.message}</span>
        ) : null}
      </p>
    </form>
  );
}

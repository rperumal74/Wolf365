import { getEnv } from "@/env";

/**
 * In-app support contact, configured via WOLF365_SUPPORT_CONTACT. Accepts an
 * email address (rendered as a mailto:) or an http(s) support URL.
 */
export function supportContact(): { value: string; href: string; isEmail: boolean } {
  const value = getEnv().WOLF365_SUPPORT_CONTACT.trim();
  const isEmail = value.includes("@") && !/^https?:\/\//i.test(value);
  return { value, href: isEmail ? `mailto:${value}` : value, isEmail };
}

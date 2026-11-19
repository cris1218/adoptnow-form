export const CONTACT_WHATSAPP = "42999007638";
export const CONTACT_WHATSAPP_LINK = `https://wa.me/55${CONTACT_WHATSAPP}`;
export const CONTACT_INSTAGRAM_LINK =
  "https://www.instagram.com/recanto_do_ronron/";
export const CONTACT_FACEBOOK_LINK =
  "https://www.facebook.com/recoantodoronron";

export function whatsappInterestLink(catName: string): string {
  const text = `Olá! Tenho interesse em adotar o gatinho ${catName.trim()}.`;
  return `${CONTACT_WHATSAPP_LINK}?text=${encodeURIComponent(text)}`;
}

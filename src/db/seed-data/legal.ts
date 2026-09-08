/**
 * The privacy policy and terms of service.
 *
 * The pages previously held these as JSX, which is why the body is modelled
 * here as blocks instead of an HTML string: serving markup would mean the
 * frontend either trusting it with dangerouslySetInnerHTML or parsing it, and
 * neither is worth it for prose this structured.
 *
 * A block is a paragraph or a list. Its content is a run of inline pieces:
 * `{ text }` for plain copy and `{ text, href }` for a link — so a sentence
 * with a link in the middle keeps its spacing without the view guessing.
 */

export type Inline = { text: string; href?: string };
export type LegalBlock =
  | { type: "p"; content: Inline[] }
  | { type: "ul"; items: Inline[][] };

export type LegalSection = { id: string; title: string; blocks: LegalBlock[] };

export type SeedLegalDocument = {
  slug: string;
  title: string;
  kicker: string;
  summary: string;
  updatedLabel: string;
  sections: LegalSection[];
};

const t = (text: string): Inline[] => [{ text }];
const p = (text: string): LegalBlock => ({ type: "p", content: t(text) });

const UPDATED_LABEL =
  "Last updated August 2026 · Demo — synthetic placeholder text, not legal advice.";

const CONTACT_HREF = "/#contact";

export const LEGAL_DOCUMENTS: readonly SeedLegalDocument[] = [
  {
    slug: "privacy",
    title: "Privacy Policy",
    kicker: "Legal",
    summary: "What we collect when you build a request or create an account, and how we use it.",
    updatedLabel: UPDATED_LABEL,
    sections: [
      {
        id: "intro",
        title: "Overview",
        blocks: [
          p(
            "Events & Media (“we”) connects people with local event and media professionals. This policy explains what we collect and how we use it.",
          ),
        ],
      },
      {
        id: "collect",
        title: "Information we collect",
        blocks: [
          p("We collect what you share when you build a request or create an account:"),
          {
            type: "ul",
            items: [
              t("Contact details (name, email, phone)."),
              t("Event details you enter into the builder."),
              t("Usage data to improve the product."),
            ],
          },
        ],
      },
      {
        id: "use",
        title: "How we use it",
        blocks: [
          p(
            "To match you with vetted pros, send quotes, and improve our service. We never sell your personal data.",
          ),
        ],
      },
      {
        id: "share",
        title: "Sharing",
        blocks: [
          p(
            "We share only the details a matched pro needs to serve your event, and with providers that run our platform.",
          ),
        ],
      },
      {
        id: "rights",
        title: "Your rights",
        blocks: [
          p(
            "You can access, correct or delete your data anytime by contacting us. You control marketing preferences from your account.",
          ),
        ],
      },
      {
        id: "contact",
        title: "Contact",
        blocks: [
          {
            type: "p",
            content: [
              { text: "Questions? Email hello@eventsandmedia.demo or use our " },
              { text: "contact page", href: CONTACT_HREF },
              { text: "." },
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "terms",
    title: "Terms of Service",
    kicker: "Legal",
    summary: "The terms you agree to when you use the marketplace.",
    updatedLabel: UPDATED_LABEL,
    sections: [
      {
        id: "intro",
        title: "Agreement",
        blocks: [p("By using Events & Media you agree to these terms. Please read them.")],
      },
      {
        id: "service",
        title: "The service",
        blocks: [
          p(
            "We are a marketplace that connects you with independent local pros. We facilitate requests and quotes; the pros deliver the services.",
          ),
        ],
      },
      {
        id: "accounts",
        title: "Accounts",
        blocks: [
          p("You’re responsible for your account and for the accuracy of the details you submit."),
        ],
      },
      {
        id: "pricing",
        title: "Pricing & quotes",
        blocks: [
          p(
            "All prices shown are sample estimates. Final pricing is confirmed in your quote before anything is booked.",
          ),
        ],
      },
      {
        id: "conduct",
        title: "Acceptable use",
        blocks: [
          p("Don’t misuse the platform, submit false requests, or infringe others’ rights."),
        ],
      },
      {
        id: "liability",
        title: "Liability",
        blocks: [
          p(
            "The service is provided “as is” for this demo. We are not liable for third-party services in this placeholder build.",
          ),
        ],
      },
      {
        id: "contact",
        title: "Contact",
        blocks: [
          {
            type: "p",
            content: [
              { text: "Reach us anytime via the " },
              { text: "contact page", href: CONTACT_HREF },
              { text: "." },
            ],
          },
        ],
      },
    ],
  },
];

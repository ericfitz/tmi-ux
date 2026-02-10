/**
 * Server configuration response from GET /config endpoint.
 *
 * This interface represents the public configuration that the TMI server
 * exposes for client applications. Fields are optional because the server
 * may not yet support all branding/customization features.
 */
export interface ServerConfig {
  features?: Record<string, boolean>;
  operator?: {
    name?: string;
    contact?: string;
    jurisdiction?: string;
  };
  limits?: Record<string, number>;
  ui?: {
    default_theme?: string;
    /** URL to a PNG logo image to replace the default TMI logo */
    logo_url?: string;
    /** Organization name displayed in the page footer */
    organization_name?: string;
    /** URL the organization name links to (opens in new tab) */
    organization_url?: string;
    /** URL for a "Support" link in the footer (opens in new tab) */
    support_url?: string;
    /** Free-text confidentiality warning displayed on report title page */
    confidentiality_warning?: string;
    /** Data classification string displayed in page footer and reports */
    data_classification?: string;
    /** URL template for user directory links, e.g. "https://dir.example.com/?email={{user.email}}" */
    user_hyperlink_template?: string;
    /** Auth provider ID that must match for user hyperlinking to activate */
    user_hyperlink_provider?: string;
  };
}

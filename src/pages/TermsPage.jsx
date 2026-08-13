import { Link } from "react-router-dom";
import Layout from "../components/Layout";

const APP_NAME = "Hashmi Mart";
const OPERATOR = "Hashmi Network";
const SUPPORT_EMAIL = "support@hashminetwork.com";
const PHONE_HREF = "tel:+923087696420";
const PHONE = "+92 308 7696420";

export default function TermsPage() {
  return (
    <Layout title="Terms & Conditions" showBack backTo="/">
      <article className="legal-page">
        <header className="legal-page__header">
          <p className="legal-page__updated">Last updated: August 13, 2026</p>
          <p>
            These terms govern your use of {APP_NAME} and the {OPERATOR}{" "}
            website. Please read them carefully before creating an account or
            placing an order.
          </p>
        </header>

        <h2>1. Acceptance of terms</h2>
        <p>
          By accessing or using {APP_NAME} (the “app”) or this website, you
          agree to be bound by these Terms &amp; Conditions. If you do not
          agree, please do not use the service.
        </p>

        <h2>2. Use of the service</h2>
        <p>
          The app lets you browse a grocery catalogue, place orders (including
          Direct Orders and voice orders), track deliveries, and communicate
          with our support team. You may use the service only for lawful
          purposes and in accordance with these terms.
        </p>

        <h2>3. User accounts</h2>
        <p>
          To place orders you must create an account with a valid email address
          and password. You are responsible for keeping your login credentials
          secure and for all activity that happens under your account. You must
          provide accurate information, including a correct delivery address.
        </p>

        <h2>4. Your responsibilities</h2>
        <ul>
          <li>Provide accurate, current information when placing orders.</li>
          <li>
            Make sure someone is available to receive the delivery at the
            address you provide.
          </li>
          <li>Keep your account credentials confidential.</li>
          <li>
            Use the app, including voice orders, in a respectful and lawful
            manner.
          </li>
        </ul>

        <h2>5. Prohibited activities</h2>
        <ul>
          <li>Creating fake or multiple accounts to abuse the service.</li>
          <li>Attempting to access another user&apos;s account or data.</li>
          <li>
            Misusing the support chat, direct orders or voice orders (for
            example, sending abusive content).
          </li>
          <li>
            Interfering with the app, its servers, or its security features.
          </li>
          <li>Using the service for any unlawful purpose.</li>
        </ul>

        <h2>6. Orders &amp; delivery</h2>
        <p>
          Orders are accepted at our discretion and are subject to product
          availability. Order status moves from pending to confirmed to
          delivered (or cancelled). You can cancel an order while it is still
          pending. Delivery is currently available in Lahore; delivery options
          are shown at checkout based on your society and address.
        </p>

        <h2>7. Payments</h2>
        <p>
          We accept Cash on Delivery and JazzCash. Prices are shown in Pakistani
          Rupees (Rs.) and include applicable sale and discount pricing. You
          agree to pay the amount due for every order you place.
        </p>

        <h2>8. Intellectual property</h2>
        <p>
          The app, website, logo, and content are the property of {OPERATOR} or
          its licensors. You may not copy, modify, distribute or reuse them
          without permission.
        </p>

        <h2>9. Third-party services</h2>
        <p>
          The app relies on third-party providers to operate, including Supabase
          (hosting, authentication and database), Vercel (hosting) and Groq (AI
          support chat). Your use of the app is also subject to the terms and
          privacy policies of these providers where applicable.
        </p>

        <h2>10. Availability</h2>
        <p>
          We work to keep the app available and fast, but we do not guarantee
          uninterrupted availability. The service may be temporarily
          unavailable for maintenance, or due to factors outside our control.
        </p>

        <h2>11. Disclaimer</h2>
        <p>
          The service is provided “as is” and “as available”, without
          warranties of any kind, express or implied, to the maximum extent
          permitted by law. While we strive for accuracy, product availability,
          pricing and delivery times may change.
        </p>

        <h2>12. Limitation of liability</h2>
        <p>
          To the maximum extent permitted by law, {OPERATOR} is not liable for
          indirect, incidental or consequential damages arising from your use
          of the service. Our total liability in connection with the service is
          limited to the amount you paid for the relevant order.
        </p>

        <h2>13. Account termination</h2>
        <p>
          We may suspend or terminate your account if you breach these terms or
          misuse the service. You may stop using the app at any time, and you
          may delete your account through the{" "}
          <Link to="/delete-account">Delete Account</Link> page.
        </p>

        <h2>14. Changes to these terms</h2>
        <p>
          We may update these terms from time to time. The “Last updated” date
          at the top of this page reflects the latest revision, and material
          changes will be communicated through the app.
        </p>

        <h2>15. Governing law</h2>
        <p>
          <span className="legal-page__placeholder">
            Governing law placeholder — the jurisdiction (expected: Pakistan)
            and dispute-resolution mechanism will be confirmed by the operator.
          </span>
        </p>

        <h2>16. Contact</h2>
        <p>
          Questions about these terms? Contact us at{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> or{" "}
          <a href={PHONE_HREF}>{PHONE}</a>.
        </p>
      </article>
    </Layout>
  );
}

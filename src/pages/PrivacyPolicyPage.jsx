import { Link } from "react-router-dom";
import Layout from "../components/Layout";

const APP_NAME = "Hashmi Mart";
const OPERATOR = "Hashmi Network";
const SUPPORT_EMAIL = "support@hashminetwork.com";
const PRIVACY_EMAIL = "privacy@hashminetwork.com";
const PHONE_HREF = "tel:+923087696420";
const PHONE = "+92 308 7696420";

export default function PrivacyPolicyPage() {
  return (
    <Layout title="Privacy Policy" showBack backTo="/">
      <article className="legal-page">
        <header className="legal-page__header">
          <p className="legal-page__updated">Last updated: August 13, 2026</p>
          <p>
            This policy explains what information {APP_NAME} (operated by{" "}
            {OPERATOR}) collects, how it is used, and the choices you have. It
            applies to the app, its website, and related services.
          </p>
        </header>

        <h2>1. Introduction</h2>
        <p>
          {APP_NAME} is a grocery delivery app (a Progressive Web App) serving
          households in Lahore, Pakistan. This Privacy Policy describes the
          information we collect when you use the app or this website, how we
          use it, and the rights you have over it.
        </p>
        <p>
          By creating an account or using the app, you agree to the practices
          described in this policy. If you do not agree, please do not use the
          service.
        </p>

        <h2>2. Who we are</h2>
        <p>
          {OPERATOR} operates the {APP_NAME} app and this website. The app is
          built on Supabase (authentication, database, file storage and
          real-time features) and is hosted on Vercel.
        </p>
        <p>
          <span className="legal-page__placeholder">
            Operator details placeholder — the legal entity name and registered
            address will be added here when confirmed.
          </span>
        </p>

        <h2>3. Information we collect</h2>
        <p>
          We collect only the information needed to run the service. We do not
          collect advertising identifiers and we do not profile you for
          advertising.
        </p>
        <h3>Account information</h3>
        <ul>
          <li>
            <strong>Email address and password</strong> — required to create an
            account. Passwords are stored by Supabase Auth as salted, hashed
            values; we never see or store your plain-text password.
          </li>
          <li>
            <strong>Full name and phone number</strong> — provided when you
            sign up, stored in your profile and used for delivery and support
            contact. Phone number is optional but helps us reach you about
            your delivery.
          </li>
          <li>
            Account-related emails only: a confirmation email when you sign up
            and a password reset email if you request one. We do not send
            marketing email or SMS.
          </li>
        </ul>
        <h3>Order information</h3>
        <ul>
          <li>
            Your name, phone number, delivery city, society and delivery
            address, the items and quantities you order (including a snapshot
            of each item&apos;s price and unit), the order total, and your
            payment method choice — Cash on Delivery or JazzCash.
          </li>
          <li>Order status and history, including estimated delivery time.</li>
          <li>
            We do not collect or store card numbers. Cash on Delivery is paid
            in person and JazzCash payments are settled outside the app.
          </li>
        </ul>
        <h3>Direct orders &amp; voice orders</h3>
        <ul>
          <li>
            When you use Direct Order, we collect the delivery address and the
            details you provide about what you need.
          </li>
          <li>
            When you record a voice order, your <strong>voice note</strong> is
            uploaded to our secure storage so our team can listen to it and
            fulfil your order. Order voice notes are kept only as long as
            needed to process your order.
          </li>
        </ul>
        <h3>Support and communication</h3>
        <ul>
          <li>
            Chat messages you send through the in-app support chat (including
            conversations with the AI assistant and with store staff).
          </li>
          <li>
            Voice notes you record in support chat, which are transcribed by
            the assistant and then <strong>deleted immediately</strong> — only
            the text transcript is kept.
          </li>
          <li>Any messages you send us through the support chat or email.</li>
        </ul>
        <h3>In-app notifications</h3>
        <ul>
          <li>
            Order status updates are shown as in-app notifications only. The
            app does not use push notification services.
          </li>
        </ul>
        <h3>Device and technical information</h3>
        <ul>
          <li>
            Basic technical data such as IP address, browser and device type,
            and app version, collected by our hosting providers (Supabase and
            Vercel) for security and operation.
          </li>
          <li>
            We do not run third-party analytics or advertising trackers on the
            app or website.{" "}
            <span className="legal-page__placeholder">
              If analytics are added later, this section will be updated.
            </span>
          </li>
        </ul>
        <h3>Stored on your device</h3>
        <ul>
          <li>
            Your shopping cart, wishlist, saved delivery addresses, a cached
            copy of the product catalogue, your session identifier and theme
            preference are stored in your browser&apos;s local storage.
          </li>
          <li>
            Supabase stores your login session locally so you stay signed in.
            This data is cleared from your device when you log out.
          </li>
        </ul>

        <h2>4. How we use your information</h2>
        <ul>
          <li>To create and manage your account and keep you signed in.</li>
          <li>
            To process and deliver your orders, including contacting you about
            delivery.
          </li>
          <li>To listen to and fulfil voice orders you send us.</li>
          <li>
            To provide support through the AI assistant and store staff,
            including transcribing voice notes so they can be answered.
          </li>
          <li>To show you in-app notifications about your orders.</li>
          <li>To keep the service secure and operating correctly.</li>
        </ul>

        <h2>5. Legal basis</h2>
        <p>
          <span className="legal-page__placeholder">
            Legal basis placeholder — the operator will confirm the applicable
            data protection law and legal grounds (contract performance,
            legitimate interest, consent) here.
          </span>{" "}
          In practice, we process your data to provide the service you asked
          for, to comply with legal obligations, and to protect our legitimate
          interests.
        </p>

        <h2>6. Data sharing &amp; third-party services</h2>
        <p>
          We do not sell your personal information. We share data only with the
          services required to operate the app, and only for the purposes
          described in this policy:
        </p>
        <ul>
          <li>
            <strong>Supabase</strong> — authentication, PostgreSQL database,
            file storage (product images, order voice notes, chat audio) and
            real-time features. Data is protected by row-level security so you
            can only access your own data.
          </li>
          <li>
            <strong>Vercel</strong> — hosting of the app and this website,
            including the serverless functions that power support chat and
            voice search.
          </li>
          <li>
            <strong>Groq</strong> — powers the AI support assistant and
            transcribes voice notes. Chat messages and audio may be sent to
            Groq to generate a response; audio is deleted after transcription.
          </li>
          <li>
            <strong>Unsplash, Pexels and Pixabay</strong> — used by store staff
            to search for product images in the admin dashboard. Your personal
            data is not shared with these services.
          </li>
          <li>
            <strong>JazzCash</strong> — payments are arranged manually by the
            store; the app itself does not transmit payment data to JazzCash.
          </li>
          <li>
            <strong>Google Fonts</strong> — fonts are loaded from Google&apos;s
            servers to display the website; no personal data is involved.
          </li>
        </ul>

        <h2>7. Cookies &amp; local storage</h2>
        <p>
          The app and website do not use advertising or tracking cookies. We
          use browser local storage to keep you signed in and to remember your
          cart, wishlist, cached catalogue and theme preference. This data
          stays on your device and is not used for advertising.
        </p>

        <h2>8. Data security</h2>
        <p>
          We protect your data with industry-standard measures: encrypted
          connections (HTTPS), Supabase&apos;s database security features
          including Row Level Security (RLS) so users can only access their own
          data, and restricted access to administrative accounts. Voice notes
          are stored in private storage buckets and removed as soon as they are
          no longer needed. No method of transmission or storage is 100%
          secure, but we work to protect your information.
        </p>

        <h2>9. Data retention</h2>
        <p>
          We keep your personal data only as long as needed to provide the
          service and meet legal obligations. The app enforces these retention
          periods automatically:
        </p>
        <ul>
          <li>
            <strong>Support chat messages and chat voice notes:</strong>{" "}
            removed automatically after 24 hours by a daily cleanup job. Voice
            notes sent to the support assistant are deleted immediately after
            they are transcribed — only the text transcript is kept.
          </li>
          <li>
            <strong>Voice search audio:</strong> deleted automatically right
            after it is transcribed into a search query.
          </li>
          <li>
            <strong>Order voice notes:</strong> kept only as long as needed to
            fulfil and complete your order.
          </li>
          <li>
            <strong>Product images:</strong> kept while the product is listed
            in the store.
          </li>
          <li>
            <strong>Account and order records:</strong>{" "}
            <span className="legal-page__placeholder">
              retention period placeholder — the operator will confirm how long
              account and order records are kept for tax and accounting
              purposes.
            </span>
          </li>
        </ul>

        <h2>10. Data deletion</h2>
        <p>
          You can delete your account at any time. When you do, we remove your
          account, profile, wishlist, notifications, chat history, uploaded
          voice notes and personal data from our systems, except for records we
          are legally required to keep (such as order records for accounting
          purposes).
        </p>
        <p>
          To request deletion, use the{" "}
          <Link to="/delete-account">Delete Account</Link> page in the app, or
          contact us and we&apos;ll process the request for you.
        </p>

        <h2>11. Your rights</h2>
        <p>
          You have the right to access the personal data we hold about you, to
          ask for corrections, to request deletion, and to object to or
          restrict certain processing.{" "}
          <span className="legal-page__placeholder">
            Rights placeholder — specific rights under the applicable law of
            Pakistan will be confirmed here.
          </span>{" "}
          To exercise any of these rights, contact us using the details below.
        </p>

        <h2>12. Children&apos;s privacy</h2>
        <p>
          {APP_NAME} is intended for adults shopping for their household. It is
          not directed at children, and we do not knowingly collect personal
          information from children.{" "}
          <span className="legal-page__placeholder">
            Age threshold placeholder — to be confirmed to match applicable
            law.
          </span>{" "}
          If you believe a child has provided us personal information, contact
          us and we will delete it.
        </p>

        <h2>13. Changes to this policy</h2>
        <p>
          We may update this policy from time to time. The “Last updated” date
          at the top of this page will always show the latest revision, and
          significant changes will be communicated through the app.
        </p>

        <h2>14. Contact</h2>
        <p>Questions about this policy or your data? Contact us at:</p>
        <ul>
          <li>
            Email:{" "}
            <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>
          </li>
          <li>
            Support: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
          </li>
          <li>
            Phone: <a href={PHONE_HREF}>{PHONE}</a>
          </li>
          <li>
            Lahore, Pakistan —{" "}
            <span className="legal-page__placeholder">
              full operator address to be added here.
            </span>
          </li>
        </ul>
      </article>
    </Layout>
  );
}

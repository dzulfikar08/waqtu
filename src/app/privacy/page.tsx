import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Waqtu",
  description: "Privacy policy for Waqtu prayer times app for Mac.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen px-6 py-16 sm:px-10 md:px-14 md:py-24">
      <div className="mx-auto max-w-3xl">
        <h1 className="font-display mb-8 text-3xl font-semibold tracking-tight text-[var(--waqtu-text)] sm:text-4xl">
          Privacy Policy
        </h1>

        <div className="max-w-none space-y-6 text-[var(--waqtu-muted)]">
          <p className="text-[var(--waqtu-text)]">
            Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
          </p>

          <section className="space-y-4">
            <h2 className="font-display mb-4 text-xl font-semibold text-[var(--waqtu-text)]">
              Information We Collect
            </h2>
            <p>
              Waqtu is designed to respect your privacy. We collect minimal information necessary to provide the prayer times service:
            </p>
            <ul className="ml-6 list-disc space-y-2">
              <li>
                <strong className="text-[var(--waqtu-text)]">Location Data</strong> — Used solely for calculating accurate prayer times. Processed locally on your device and never transmitted to our servers.
              </li>
              <li>
                <strong className="text-[var(--waqtu-text)]">Email Address</strong> — Collected only when you choose to purchase a license. Used for payment processing and license delivery.
              </li>
              <li>
                <strong className="text-[var(--waqtu-text)]">License Information</strong> — Stored to validate your purchase and provide updates.
              </li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="font-display mb-4 text-xl font-semibold text-[var(--waqtu-text)]">
              Information We Don't Collect
            </h2>
            <p>We do NOT collect:</p>
            <ul className="ml-6 list-disc space-y-2">
              <li>Personal identification beyond what you voluntarily provide</li>
              <li>Usage analytics or tracking</li>
              <li>Device fingerprinting</li>
              <li>Prayer attendance or religious practice data</li>
              <li>Calendar event content or details</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="font-display mb-4 text-xl font-semibold text-[var(--waqtu-text)]">
              How Your Information Is Used
            </h2>
            <ul className="ml-6 list-disc space-y-2">
              <li>To calculate and display accurate prayer times based on your location</li>
              <li>To process payments and deliver lifetime licenses</li>
              <li>To provide app updates and bug fixes</li>
              <li>To respond to your support inquiries</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="font-display mb-4 text-xl font-semibold text-[var(--waqtu-text)]">
              Data Storage & Security
            </h2>
            <ul className="ml-6 list-disc space-y-2">
              <li>Your location data never leaves your device</li>
              <li>Email and license information are stored securely and used only for essential purposes</li>
              <li>We use industry-standard payment processors (Polar) and do not store your payment details</li>
              <li>We do not sell, rent, or share your personal data with third parties</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="font-display mb-4 text-xl font-semibold text-[var(--waqtu-text)]">
              Data Retention
            </h2>
            <p>You may request deletion of your email and license information at any time by contacting us at <a href="mailto:dzulfikar.at@gmail.com" className="text-[var(--waqtu-primary)] hover:underline">dzulfikar.at@gmail.com</a>. We will respond within 30 days.</p>
          </section>

          <section className="space-y-4">
            <h2 className="font-display mb-4 text-xl font-semibold text-[var(--waqtu-text)]">
              Children&apos;s Privacy
            </h2>
            <p>Waqtu is not directed to children under 13. We do not knowingly collect personal information from children under 13.</p>
          </section>

          <section className="space-y-4">
            <h2 className="font-display mb-4 text-xl font-semibold text-[var(--waqtu-text)]">
              Changes to This Policy
            </h2>
            <p>We may update this privacy policy from time to time. The updated version will be posted on this page with a revised &quot;Last updated&quot; date.</p>
          </section>

          <section className="space-y-4">
            <h2 className="font-display mb-4 text-xl font-semibold text-[var(--waqtu-text)]">
              Contact Us
            </h2>
            <p>If you have questions about this privacy policy or how we handle your data, please contact us at <a href="mailto:dzulfikar.at@gmail.com" className="text-[var(--waqtu-primary)] hover:underline">dzulfikar.at@gmail.com</a>.</p>
          </section>
        </div>
      </div>
    </div>
  );
}

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — Waqtu",
  description: "Terms of service for Waqtu prayer times app for Mac.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen px-6 py-16 sm:px-10 md:px-14 md:py-24">
      <div className="mx-auto max-w-3xl">
        <h1 className="font-display mb-8 text-3xl font-semibold tracking-tight text-[var(--waqtu-text)] sm:text-4xl">
          Terms of Service
        </h1>

        <div className="max-w-none space-y-6 text-[var(--waqtu-muted)]">
          <p className="text-[var(--waqtu-text)]">
            Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
          </p>

          <section className="space-y-4">
            <h2 className="font-display mb-4 text-xl font-semibold text-[var(--waqtu-text)]">
              Agreement to Terms
            </h2>
            <p>
              By downloading, installing, or using Waqtu (&quot;the App&quot;), you agree to be bound by these Terms of Service (&quot;Terms&quot;). If you do not agree to these Terms, please do not use the App.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="font-display mb-4 text-xl font-semibold text-[var(--waqtu-text)]">
              License Grant
            </h2>
            <p>
              Subject to your compliance with these Terms and payment of the applicable license fee, Waqtu grants you a non-exclusive, non-transferable license to use the App on up to one (1) Mac device. This license is personal to you and may not be shared or transferred to others.
            </p>
            <ul className="ml-6 list-disc space-y-2">
              <li><strong className="text-[var(--waqtu-text)]">Permitted Uses:</strong> Installation and use on one Mac device that you own or control.</li>
              <li><strong className="text-[var(--waqtu-text)]">Prohibited Uses:</strong> Sharing, redistributing, or transferring the license to others; reverse engineering; attempting to circumvent license verification.</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="font-display mb-4 text-xl font-semibold text-[var(--waqtu-text)]">
              Payment &amp; Refunds
            </h2>
            <ul className="ml-6 list-disc space-y-2">
              <li>Waqtu is offered as a one-time lifetime purchase</li>
              <li>Payment is processed through Polar.sh, a third-party payment processor</li>
              <li>Due to the digital nature of the product, all sales are final</li>
              <li>Refunds may be considered on a case-by-case basis within 14 days of purchase if the App does not function as described</li>
              <li>License is delivered immediately upon purchase confirmation</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="font-display mb-4 text-xl font-semibold text-[var(--waqtu-text)]">
              User Responsibilities
            </h2>
            <p>As a user of Waqtu, you agree to:</p>
            <ul className="ml-6 list-disc space-y-2">
              <li>Use the App only for its intended purpose</li>
              <li>Comply with all applicable laws and regulations</li>
              <li>Not attempt to circumvent payment or licensing systems</li>
              <li>Respect the one-device license limitation</li>
              <li>Provide accurate information when making a purchase</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="font-display mb-4 text-xl font-semibold text-[var(--waqtu-text)]">
              Disclaimer of Warranties
            </h2>
            <p>THE APP IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES, OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT, OR OTHERWISE, ARISING FROM, OUT OF, OR IN CONNECTION WITH THE APP OR THE USE OR OTHER DEALINGS IN THE APP.</p>
          </section>

          <section className="space-y-4">
            <h2 className="font-display mb-4 text-xl font-semibold text-[var(--waqtu-text)]">
              Prayer Times Accuracy
            </h2>
            <p>
              While Waqtu strives to provide accurate prayer times using recognized calculation methods, we make no guarantees about the absolute accuracy of prayer times. Users should verify prayer times with local Islamic authorities or mosques when precision is critical (e.g., for fasting).
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="font-display mb-4 text-xl font-semibold text-[var(--waqtu-text)]">
              Intellectual Property
            </h2>
            <p>
              The App, its appearance, and all content, features, and functionality are owned by Waqtu and are protected by international copyright, trademark, and other intellectual property laws. You may not remove, alter, or obscure any copyright, trademark, or other proprietary rights notices.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="font-display mb-4 text-xl font-semibold text-[var(--waqtu-text)]">
              Termination
            </h2>
            <p>
              Your license under these Terms is effective until terminated. Your right to use the App may be terminated if you fail to comply with these Terms. Upon termination, your license to use the App will be revoked.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="font-display mb-4 text-xl font-semibold text-[var(--waqtu-text)]">
              Changes to Terms
            </h2>
            <p>
              We reserve the right to modify these Terms at any time. Continued use of the App after changes constitutes acceptance of the modified Terms. Material changes will be highlighted on this page.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="font-display mb-4 text-xl font-semibold text-[var(--waqtu-text)]">
              Governing Law
            </h2>
            <p>
              These Terms are governed by the laws of Malaysia, without regard to its conflict of law provisions.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="font-display mb-4 text-xl font-semibold text-[var(--waqtu-text)]">
              Contact
            </h2>
            <p>
              Questions about these Terms should be sent to <a href="mailto:dzulfikar.at@gmail.com" className="text-[var(--waqtu-primary)] hover:underline">dzulfikar.at@gmail.com</a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

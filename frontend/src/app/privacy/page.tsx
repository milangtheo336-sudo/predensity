'use client';

import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="bg-card border border-border rounded-xl p-8 sm:p-12 shadow-sm">
          <h1 className="text-2xl font-bold text-center mb-2">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground text-center mb-8">Last Updated: March 15, 2026</p>

          <section className="space-y-6 text-sm leading-relaxed text-foreground/90">
            <div>
              <h2 className="text-lg font-semibold mb-3">Introduction</h2>
              <p className="mb-3">
                This website-hosted user interface (this "Interface") is made available by Predensity (the "Company," "us," "we," or "our").
                This Privacy Policy (the "Policy") governs the manner in which we make the Interface available and how we collect, use,
                maintain and disclose information collected from our users (each, a "user," "you," or "your") through the Company's websites,
                including the Interface, web applications, mobile applications and all associated sites linked thereto by the Interface, or
                by us or our affiliates (the "Site").
              </p>
              <p className="mb-3">
                This Policy further applies to all information we collect through our Site and otherwise obtain in connection with products
                and Services, content, features, technologies, functions and all related websites we may provide to you or to which we may
                provide access (collectively with the Site, the "Services").
              </p>
              <p className="mb-3">
                Please read this Policy carefully. We are committed to protecting your privacy through our compliance with the terms of this Policy.
                You may e-mail us at legal@predensity.com with any concerns or privacy-related questions.
              </p>
              <p className="mb-3">
                Our <Link href="/terms" className="text-vibrant-purple hover:underline">Terms of Use</Link> ("Terms") govern all use of our
                Services and, together with this Privacy Policy, constitute your agreement with us (the "Agreement"). If you do not agree with
                the terms of this Policy, please do not access our Site.
              </p>
              <p className="mb-3">
                By accessing or using our Services, you agree to the terms of this Policy. Specifically, by (i) using, visiting, or accessing
                the Services, (ii) using, accessing, establishing an account through or purchasing any of the Services, and/or (iii) clicking
                "accept," "agree," or "OK" with respect to any of our Terms or similar policies, you consent and agree to be legally bound by
                each of the terms and conditions contained in this Policy.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-3">Applicability</h2>
              <p className="mb-3">
                This Policy applies to all information we collect from you in connection with the Site and offering the Services. This Policy
                does not apply to information collected by us offline or through any other means, including on any other website made available
                by us or by any third party (including our affiliates and subsidiaries).
              </p>
              <p className="mb-3">
                Throughout this Policy, we use the term "personal information" to describe information that can be associated with a specific
                person and can be used to identify that person. We do not consider personal information to include information that has been
                aggregated and/or anonymized so that it does not identify a specific user.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-3">Information Collection and Use</h2>
              <p className="mb-3">
                When you visit the Site and use the Services, we collect your IP address and standard web log information, such as your
                browser type and pages you accessed on our Site. We may also collect certain geolocation information.
              </p>
              <p className="mb-2">We collect information:</p>
              <ul className="list-disc list-inside space-y-1 ml-2 mb-3">
                <li>Directly from you when you provide it to us.</li>
                <li>Automatically as you navigate through the site, including usage details, IP addresses, and information collected through cookies and other tracking technologies.</li>
                <li>In certain instances, from third parties such as our business partners, third-party wallet providers (e.g., HashPack, MetaMask) or other networks where you have connected your account.</li>
              </ul>
              <p className="mb-2">If you create an account with us, we may collect the following:</p>
              <ul className="list-disc list-inside space-y-1 ml-2 mb-3">
                <li><span className="font-medium">Personal Information:</span> Name, postal address, e-mail address, telephone number, date of birth, and other demographic information you voluntarily provide.</li>
                <li><span className="font-medium">Derivative Information:</span> IP address, browser type, operating system, access times, and pages viewed directly before and after accessing the Site.</li>
                <li><span className="font-medium">Financial Information:</span> Bank account information, credit card information, and other payment data processed by our third-party payment vendors and wallet providers.</li>
                <li><span className="font-medium">Mobile Device Information:</span> Device type, mobile device identification number, geolocation, time zone, language setting, and browser type.</li>
                <li><span className="font-medium">Geolocation Information:</span> Location data obtained through GPS, Wi-Fi, or cell-site triangulation for fraud prevention and risk management.</li>
              </ul>
              <p className="mb-3">
                We may require additional information from you (including government-issued identity documents) to verify your identity,
                address, or other information, prevent fraud, or manage risk and compliance.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-3">Children Under the Age of 18</h2>
              <p className="mb-3">
                Our Site is not intended for children under 18 years of age. No one under age 18 may provide any personal information to
                or on the Site. If we obtain actual knowledge that we have collected personal information from a person under the age of 18,
                we will promptly delete it, unless we are legally obligated to retain such data.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-3">Use of Cookies and Other Tracking Technologies</h2>
              <p className="mb-3">
                When you visit our Site and use our Services, we and certain business partners and vendors may use cookies and other tracking
                technologies. We use cookies to recognize you as a customer, customize the Services, measure the effectiveness of our
                promotions, perform analytics, mitigate risk and prevent potential fraud, and promote trust and safety across our Services.
              </p>
              <p className="mb-3">
                Most browsers are set to accept cookies by default. You can remove or reject cookies. However, certain Services are only
                available through the use of cookies. Therefore, if you choose to disable or decline cookies, your use of the Services may
                be limited or not possible.
              </p>
              <p className="mb-3">
                Do Not Track: We do not respond to DNT signals. You can enable or disable DNT by visiting the preferences or settings page
                of your web browser.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-3">Use of Your Information</h2>
              <p className="mb-2">We may use information collected about you via the Site to:</p>
              <ul className="list-disc list-inside space-y-1 ml-2 mb-3">
                <li>Create and manage your account and provide personalized experiences.</li>
                <li>Deliver the Services and provide customer support.</li>
                <li>Detect security incidents and protect against malicious, deceptive, or fraudulent activity.</li>
                <li>Monitor and analyze usage and trends to improve your experience.</li>
                <li>Process transactions (including payments and refunds) and send notices about your transactions.</li>
                <li>Verify your identity and prevent fraud.</li>
                <li>Comply with our legal obligations and enforce our terms and policies.</li>
                <li>Provide targeted advertising, newsletters, and promotional information regarding the Services.</li>
                <li>Respond to your inquiries, resolve disputes, collect fees, and troubleshoot problems.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-3">How We Protect and Store Your Information</h2>
              <p className="mb-3">
                The security of your data is important to us but remember that no method of transmission over the Internet or method of
                electronic storage is 100% secure. We strive to ensure security on our systems and use administrative, technical, and other
                physical security measures to help protect your personal information. We also use computer safeguards such as firewalls and
                data encryption, enforce access controls, and authorize access to personal information only for those employees who require
                it to fulfill their job responsibilities.
              </p>
              <p className="mb-3">
                Despite our efforts, we cannot guarantee that personal information may not be accessed, disclosed, altered or destroyed by
                breach of our safeguards. Any transmission of personal information is at your own risk.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-3">How We Share Personal Information with Other Parties</h2>
              <p className="mb-3">
                We may share your information with our business partners to offer you certain products, Services, and promotions. We may
                also use third-party advertising companies to serve ads when you visit the Site.
              </p>
              <p className="mb-3">
                Some personal information is public information (this may include your web3-enabled wallet's public address, username,
                profile photo, and public transactions) and may be seen by anyone on the Internet due to the nature of the blockchain.
              </p>
              <p className="mb-2">We may share your personal information with:</p>
              <ul className="list-disc list-inside space-y-1 ml-2 mb-3">
                <li>Law enforcement, government officials, or other third parties when compelled by legal process or to comply with law.</li>
                <li>Third-party service providers who assist us in providing the Services or fraud detection.</li>
                <li>Other third parties with your consent or at your direction, including authorized account connections with third-party platforms.</li>
                <li>Any of our parent companies, affiliates, subsidiaries, or joint ventures.</li>
                <li>In the event of a corporate sale, merger, reorganization, or similar event, your information may be part of the transferred assets.</li>
              </ul>
              <p className="mb-3">
                We do not send your personal information to third-party social networks unless you have specifically requested or authorized us to do so.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-3">Third-Party Links</h2>
              <p className="mb-3">
                The Services may contain links to unaffiliated third-party services, applications, or websites. We do not control information
                collection of any third-party services. Any information you provide to any third party is not covered by this Policy and we
                cannot guarantee the safety and privacy of your information.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-3">Third-Party Analytics</h2>
              <p className="mb-3">
                We may use third-party analytics (such as Google Analytics) to evaluate your use of the Services, compile reports on activity,
                collect demographic data, and analyze performance metrics. These third parties use cookies, pixel tags, and other tracking
                technologies. By visiting and using the Services, you consent to the processing of data about you by these analytics providers.
              </p>
              <p className="mb-3">
                For more information on Google Analytics, visit:{' '}
                <a href="https://www.google.com/analytics" target="_blank" rel="noopener noreferrer" className="text-vibrant-purple hover:underline">
                  google.com/analytics
                </a>.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-3">Your Data Protection Rights</h2>
              <p className="mb-2">Depending on applicable law where you reside, you may be able to assert certain rights:</p>
              <ul className="list-disc list-inside space-y-1 ml-2 mb-3">
                <li><span className="font-medium">Right to Access:</span> You have the right to access, update, or delete the information we have on you.</li>
                <li><span className="font-medium">Right of Correction:</span> You have the right to have your information rectified if inaccurate or incomplete.</li>
                <li><span className="font-medium">Right to Object:</span> You have the right to object to our processing of your personal information.</li>
                <li><span className="font-medium">Right of Restriction:</span> You have the right to request that we restrict the processing of your personal information.</li>
                <li><span className="font-medium">Right to Data Portability:</span> You have the right to be provided with a copy of your personal information in a structured, machine-readable format.</li>
                <li><span className="font-medium">Right to Withdraw Consent:</span> You have the right to withdraw your consent at any time where we rely on your consent to process your personal information.</li>
                <li><span className="font-medium">Right to Erasure:</span> You have the right to request deletion of your personal information from our Site.</li>
              </ul>
              <p className="mb-3">
                To exercise any of these rights, please e-mail us at legal@predensity.com with the appropriate subject line.
                We reserve the right to ask for information verifying your identity before complying with your request.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-3">Transfer of Data</h2>
              <p className="mb-3">
                Your personal information may be transferred to and maintained on computers located outside of your state, province, country
                or other governmental jurisdiction where the data protection laws may differ from those of your jurisdiction. By using the
                Services, you consent to the transfer of your information outside of your country of residence.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-3">Changes to Our Policy</h2>
              <p className="mb-3">
                We may update this Policy at any time. When we do, we will revise the updated date at the top of this page. Your continued
                use of the Site following the posting of changes to this Privacy Policy will be deemed your acceptance of those changes.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-3">Contact Us</h2>
              <p className="mb-3">
                If you have any comments or questions about this Policy, please contact us by e-mail at legal@predensity.com.
              </p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

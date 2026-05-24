'use client';

import Link from 'next/link';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="bg-card border border-border rounded-xl p-8 sm:p-12 shadow-sm">
          <h1 className="text-2xl font-bold text-center mb-2">Predensity Terms of Use</h1>
          <p className="text-sm text-muted-foreground text-center mb-8">Last Updated: March 14th, 2026</p>

          <section className="space-y-6 text-sm leading-relaxed text-foreground/90">
            <div>
              <h2 className="text-lg font-semibold mb-3">1. Introduction</h2>
              <p className="mb-3">
                These Terms of Use provide the terms and conditions under which you, whether personally or on behalf of an entity
                ("you" or "your"), are permitted to use, interact with or otherwise access the Interfaces or Features provided by
                Predensity ("the Company," "we," "us," or "our"). These Terms of Use, together with any documents and additional
                terms or policies that are appended hereto or that expressly incorporate these Terms of Use by reference as well as
                our <Link href="/privacy" className="text-vibrant-purple hover:underline">Privacy Policy</Link> (collectively, the
                "Terms"), constitute a binding agreement between you and us.
              </p>
              <p className="mb-3">
                These Terms are applicable to (i) all content, informational functionality, and information features (the "Content
                Features") available on Predensity.com (the "Site") and any other site to which the Terms are posted (each, as
                applicable, an "Interface") and (ii) software, including but not limited to the blockchain-based, smart contract
                protocol (the "Protocol") known as Predensity (hereinafter, the "Platform"), that may be available to users by
                connecting their self-hosted wallets via an Interface.
              </p>
              <p className="mb-3">
                The Site primarily functions to provide the Content Features -- that is, news and information about global current events.
              </p>
              <p className="mb-3 uppercase text-xs font-semibold tracking-wide text-muted-foreground">
                NOTICE: PLEASE REVIEW THE TERMS CAREFULLY. BY ACCESSING, INTERACTING WITH OR USING THE SITE OR ANY OTHER
                INTERFACE, YOU AGREE THAT YOU ARE ABLE TO ENTER INTO A BINDING AGREEMENT AND HAVE READ, UNDERSTOOD, AND AGREE
                TO BE BOUND BY THE TERMS, INCLUDING THE DISPUTE RESOLUTION AND CLASS ACTION WAIVER BELOW.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-3">2. The Site and Features</h2>
              <h3 className="text-base font-medium mb-2">Description of the Site and Features</h3>
              <p className="mb-3">
                The Site contains different functionality -- one part provides information about global news and events, while
                another part contains a feature that allows users to send messages to the Arc network in an entirely
                self-directed manner in order to engage in trades for certain event-based contracts (the "Contracts").
              </p>
              <p className="mb-3">
                Predensity is a developer of software. We do not operate a cryptoasset or derivatives exchange platform or offer
                trade execution or clearing services and, therefore, have no control concerning your transactions using the Features.
              </p>

              <h3 className="text-base font-medium mb-2 mt-4">No Financial Advice</h3>
              <p className="mb-3">
                The pricing information and news provided on the Site relating to Contracts do not represent an offer, a solicitation
                of an offer, or any professional, financial, or investment advice. You should independently verify all information on
                the Site before making any decisions.
              </p>

              <h3 className="text-base font-medium mb-2 mt-4">Arc Network Interaction</h3>
              <p className="mb-3">
                Predensity is deployed on the Arc network. We are not responsible for the operation, functionality,
                or security of the underlying Arc network. All transactions broadcast to the network via your Wallet may require
                the payment of non-refundable network transaction fees (USDC gas fees), which shall be borne entirely by you.
                If you click the "Connect Wallet" feature on the Site, you note that the Company (i) is not involved in transmitting
                information to networks, (ii) cannot assist in any transaction, (iii) never has access to your private keys, and
                (iv) has no authority over your cryptoassets.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-3">3. Your Responsibilities, Representations & Prohibited Conduct</h2>
              <h3 className="text-base font-medium mb-2">Your Representations</h3>
              <p className="mb-2">As a condition to accessing or using Predensity, you represent and warrant the following:</p>
              <ul className="list-disc list-inside space-y-1 ml-2 mb-3">
                <li><span className="font-medium">Of Age:</span> You are 18 years of age or older and have the legal capacity to enter into these Terms.</li>
                <li><span className="font-medium">Sanctions:</span> You are not the subject of economic or trade sanctions administered or enforced by any governmental authority (e.g., OFAC, EU, UK).</li>
                <li><span className="font-medium">Sophistication:</span> You possess sufficient knowledge, market sophistication, and experience to engage with blockchain technology, the Arc network, and smart contracts.</li>
                <li><span className="font-medium">Wallet Configuration:</span> You are solely responsible for securing your private keys, passwords, and data.</li>
                <li><span className="font-medium">Financial Risks:</span> You acknowledge that entering into Contracts on the Platform carries substantial risk. Contracts are highly experimental and volatile. BY USING PREDENSITY TO TRADE, YOU CAN LOSE UP TO THE ENTIRE AMOUNT OF THE CRYPTOASSETS SUPPLIED.</li>
                <li><span className="font-medium">Taxes:</span> You are solely responsible for determining any tax consequences from your transactions using the Site and ensuring compliance with applicable tax laws in your jurisdiction.</li>
                <li><span className="font-medium">Contract Resolution:</span> You acknowledge that Contracts are resolved by decentralized oracles in accordance with pre-defined rules, and the Company is not responsible for disputes regarding the outcome of an event.</li>
              </ul>

              <h3 className="text-base font-medium mb-2 mt-4">Prohibited Conduct</h3>
              <p className="mb-2">You agree that you will not:</p>
              <ul className="list-disc list-inside space-y-1 ml-2 mb-3">
                <li>Violate any applicable domestic or foreign laws, rules, or regulations through your access to the Site.</li>
                <li>Engage in wash trading, spoofing, front-running, fictitious transactions, or any other manipulative or fraudulent trading activity.</li>
                <li>Introduce viruses, trojan horses, worms, or other technologically harmful material to the Site or Features.</li>
                <li>Reverse engineer, decompile, or scrape data from the Interfaces using unauthorized bots or crawlers.</li>
                <li>Use the Site in any way that could disable, overburden, damage, or impair the platform for other users.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-3">4. Modifications and Third-Party Services</h2>
              <h3 className="text-base font-medium mb-2">Modifications to Terms and Features</h3>
              <p className="mb-3">
                We reserve the right, in our sole discretion, to modify the Terms, the Site, or the Features at any time, with or
                without notice to you. By continuing to access the Site after modifications become effective, you agree to be bound
                by the updated Terms. We may also suspend or disable the Site or Features at any time for maintenance, security, or
                other reasons without liability to you.
              </p>
              <h3 className="text-base font-medium mb-2 mt-4">Third-Party Information</h3>
              <p className="mb-3">
                The Site may contain links to third-party news sources, oracles, or services. We have no control over these
                third-party contents, do not endorse them, and accept no responsibility for any loss or damage that may arise
                from your reliance on them.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-3">5. Intellectual Property Rights</h2>
              <p className="mb-3">
                Predensity or its licensors own all right, title, and interest in and to the Site, Interface, and Features.
                Subject to the Terms, we grant you a personal, limited, revocable, non-exclusive license to use the Site.
              </p>
              <p className="mb-3">
                By providing any feedback, questions, or content through the Site, you grant us a royalty-free, perpetual,
                irrevocable, worldwide license to use, copy, and distribute such content for the purpose of operating, improving,
                and promoting the Platform.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-3">6. Indemnification</h2>
              <p className="mb-3">
                You agree to defend, indemnify, and hold harmless Predensity, its affiliates, licensors, and their respective
                officers and employees from and against any claims, liabilities, damages, judgments, awards, losses, costs, or
                fees (including reasonable attorneys' fees) arising out of or relating to your violation of these Terms, your use
                of the Features, or your actual or alleged infringement of any third-party rights.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-3">7. Disclaimers and Limitations of Liability</h2>
              <p className="mb-3 uppercase text-xs font-semibold tracking-wide text-muted-foreground">
                THE SITE AND FEATURES ARE PROVIDED "AS IS" AND "AS AVAILABLE." WE EXPRESSLY DISCLAIM ALL WARRANTIES, WHETHER
                EXPRESS, IMPLIED, OR STATUTORY, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
                WE DO NOT GUARANTEE THAT THE SITE WILL BE ERROR-FREE, SECURE, OR UNINTERRUPTED.
              </p>
              <p className="mb-3 uppercase text-xs font-semibold tracking-wide text-muted-foreground">
                LIMITATIONS OF LIABILITY: TO THE EXTENT PERMITTED BY LAW, PREDENSITY AND ITS SERVICE PROVIDERS WILL NOT BE LIABLE
                FOR ANY INDIRECT, INCIDENTAL, SPECIAL, OR CONSEQUENTIAL DAMAGES, INCLUDING LOSS OF PROFITS, REVENUES, DATA, OR
                CRYPTOASSETS, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. IN ANY CASE, OUR AGGREGATE
                LIABILITY WILL NOT EXCEED $100.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-3">8. Governing Law and Dispute Resolution</h2>
              <h3 className="text-base font-medium mb-2">Governing Law</h3>
              <p className="mb-3">
                These Terms and any action related thereto will be governed by the laws of Panama, without regard to its conflict
                of laws provisions.
              </p>
              <h3 className="text-base font-medium mb-2 mt-4">Mandatory Arbitration</h3>
              <p className="mb-3">
                Any dispute, claim, or controversy arising out of or relating to the Terms or Features will be determined by
                binding arbitration in Panama before one arbitrator. Prior to arbitration, parties must attempt to resolve the
                dispute via good-faith negotiations for at least forty-five (45) days.
              </p>
              <h3 className="text-base font-medium mb-2 mt-4">Class Action Waiver</h3>
              <p className="mb-3">
                Any proceeding to resolve a dispute will take place on an individual basis only. You agree that you may bring
                claims against us only in your individual capacity, and not as a plaintiff or class member in any purported class,
                consolidated, or representative proceeding.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-3">9. General Terms</h2>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li><span className="font-medium">Entire Agreement:</span> These Terms, alongside the <Link href="/privacy" className="text-vibrant-purple hover:underline">Privacy Policy</Link>, constitute the entire agreement between you and Predensity regarding the subject matter herein.</li>
                <li><span className="font-medium">Severability:</span> If any portion of these Terms is held invalid or unenforceable, the remaining portions will remain in full force and effect.</li>
                <li><span className="font-medium">No Assignment:</span> You may not assign your rights under these Terms without our prior written consent. We may assign our rights without restriction.</li>
                <li><span className="font-medium">Contact Us:</span> For questions, complaints, or claims concerning the Features, contact us at hello@predensity.com.</li>
              </ul>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

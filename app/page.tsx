import Navbar from '@/components/Navbar';
import Hero from '@/components/Hero';
import CodeGenSection from '@/components/CodeGenSection';
import ClankerSection from '@/components/ClankerSection';
import HowItWorks from '@/components/HowItWorks';
import RecentPRs from '@/components/RecentPRs';
import Footer from '@/components/Footer';

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-950">
      <Navbar />
      <Hero />
      <CodeGenSection />
      <ClankerSection />
      <HowItWorks />
      <RecentPRs />
      <Footer />
    </main>
  );
}

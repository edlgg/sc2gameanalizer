import { motion, useScroll, useTransform, useMotionValue, useSpring } from 'framer-motion';
import { useRef, useState, useCallback } from 'react';
import { ChevronDown, Upload, Database, BarChart3, Sparkles, TrendingUp, Target } from 'lucide-react';

interface LandingPageProps {
  onLogin: () => void;
  onRegister: () => void;
}

// ============================================
// SECTION 1: CINEMATIC HERO
// ============================================

function HeroSection({ onLogin, onRegister }: { onLogin: () => void; onRegister: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springConfig = { damping: 25, stiffness: 150 };
  const rotateX = useSpring(useTransform(mouseY, [-300, 300], [5, -5]), springConfig);
  const rotateY = useSpring(useTransform(mouseX, [-300, 300], [-5, 5]), springConfig);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      mouseX.set(e.clientX - centerX);
      mouseY.set(e.clientY - centerY);
    }
  }, [mouseX, mouseY]);

  const handleMouseLeave = useCallback(() => {
    mouseX.set(0);
    mouseY.set(0);
  }, [mouseX, mouseY]);

  return (
    <section
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative min-h-screen flex flex-col items-center justify-center px-4 pt-20 overflow-hidden"
    >
      {/* Particle field background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(40)].map((_, i) => (
          <div
            key={i}
            className="particle"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${4 + Math.random() * 4}s`,
              opacity: 0.2 + Math.random() * 0.4,
              width: `${2 + Math.random() * 4}px`,
              height: `${2 + Math.random() * 4}px`,
            }}
          />
        ))}
      </div>

      {/* Gradient orbs */}
      <div className="absolute top-0 left-1/4 w-[800px] h-[800px] bg-sc2-blue/10 rounded-full blur-[150px]" />
      <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-sc2-purple/10 rounded-full blur-[150px]" />

      {/* 3D Floating Dashboard Screenshot */}
      <motion.div
        className="relative z-10 w-full max-w-5xl mb-12"
        style={{
          rotateX,
          rotateY,
          transformStyle: 'preserve-3d',
        }}
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, delay: 0.2 }}
      >
        <div className="relative rounded-2xl overflow-hidden glow-intense">
          <div className="relative border border-white/10 rounded-2xl overflow-hidden">
            <img
              src="/assets/screenshots/dashboard.png"
              alt="SC2 Replay Analyzer Dashboard"
              className="w-full"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0e17] via-transparent to-transparent opacity-40" />
          </div>
        </div>
      </motion.div>

      {/* Hero Text */}
      <motion.div
        className="text-center z-10 mb-12"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.5 }}
      >
        <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 tracking-tight">
          Level Up Your StarCraft II
        </h1>
        <p className="text-xl md:text-2xl text-slate-400 max-w-3xl mx-auto mb-10">
          Upload replays. Compare to pros. Learn why you're falling behind.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <motion.button
            onClick={onRegister}
            className="group relative px-8 py-4 rounded-xl font-semibold text-lg overflow-hidden rainbow-border rainbow-border-glow"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <span className="relative text-white flex items-center gap-2 justify-center">
              <Sparkles className="w-5 h-5" />
              Get Started Free
            </span>
          </motion.button>
          <motion.button
            onClick={onLogin}
            className="px-8 py-4 rounded-xl font-semibold text-lg glass text-white hover:bg-white/10 transition-all"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Sign In &rarr;
          </motion.button>
        </div>
      </motion.div>

      {/* Floating Stats Cards */}
      <motion.div
        className="flex flex-wrap justify-center gap-8 z-10"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.8 }}
      >
        <FloatingStatCard value="12,847" label="games analyzed" delay={0} />
        <FloatingStatCard value="94%" label="find insights" delay={0.1} />
        <FloatingStatCard value="<3s" label="analysis time" delay={0.2} />
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
        animate={{ y: [0, 10, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <ChevronDown className="w-8 h-8 text-slate-500" />
      </motion.div>
    </section>
  );
}

function FloatingStatCard({ value, label, delay }: { value: string; label: string; delay: number }) {
  return (
    <motion.div
      className="glass-card rounded-xl px-6 py-4 text-center animate-float"
      style={{ animationDelay: `${delay * 2}s` }}
      whileHover={{ scale: 1.05, y: -5 }}
    >
      <div className="text-3xl font-bold text-white">{value}</div>
      <div className="text-sm text-slate-400">{label}</div>
    </motion.div>
  );
}

// ============================================
// SECTION 2: BENTO GRID FEATURES
// ============================================

function BentoGridSection() {
  return (
    <section className="py-32 px-4 relative">
      <div className="max-w-6xl mx-auto">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Everything You Need
          </h2>
          <p className="text-xl text-slate-400">
            Professional-grade analysis tools in one place
          </p>
        </motion.div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[200px]">
          {/* Large card - Game Library */}
          <BentoCard
            className="md:col-span-2 md:row-span-2"
            delay={0}
            image="/assets/screenshots/full-page-multi-game-comparison.png"
            title="Multi-Pro Comparison"
            description="Compare your game against multiple pros simultaneously with detailed analytics"
          />

          {/* Tall card - Instant Upload */}
          <BentoCard
            className="md:row-span-2"
            delay={0.1}
            icon={<Upload className="w-8 h-8" />}
            title="Instant Upload"
            description="Drag & drop your .SC2Replay files for instant analysis"
            centered
          />

          {/* Small card - Pro Database */}
          <BentoCard
            delay={0.2}
            icon={<Database className="w-6 h-6" />}
            title="Pro Match Database"
            description="10,000+ tournament replays"
            compact
          />

          {/* Wide card - Deep Analytics */}
          <BentoCard
            className="md:col-span-2"
            delay={0.3}
            image="/assets/screenshots/strategic-decision-analysis-complete.png"
            title="Decision Analysis"
            description="See exactly where your choices diverged from optimal play"
          />
        </div>
      </div>
    </section>
  );
}

function BentoCard({
  className = '',
  delay,
  image,
  icon,
  title,
  description,
  centered = false,
  compact = false,
}: {
  className?: string;
  delay: number;
  image?: string;
  icon?: React.ReactNode;
  title: string;
  description: string;
  centered?: boolean;
  compact?: boolean;
}) {
  return (
    <motion.div
      className={`group relative glass-card rounded-2xl overflow-hidden transition-all duration-300 hover:border-white/20 ${className}`}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay }}
      whileHover={{ y: -8 }}
    >
      {image && (
        <div className="absolute inset-0 overflow-hidden">
          <img
            src={image}
            alt={title}
            className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0e17] via-[#0a0e17]/60 to-transparent" />
        </div>
      )}

      <div className={`relative z-10 h-full flex flex-col ${centered ? 'items-center justify-center text-center' : 'justify-end'} p-6`}>
        {icon && (
          <div className="w-16 h-16 bg-sc2-blue/20 rounded-2xl flex items-center justify-center text-sc2-blue mb-4 animate-pulse-glow">
            {icon}
          </div>
        )}
        <h3 className={`${compact ? 'text-lg' : 'text-2xl'} font-bold text-white mb-2`}>{title}</h3>
        <p className={`${compact ? 'text-sm' : ''} text-slate-400`}>{description}</p>
      </div>

      <div className="absolute inset-0 rounded-2xl border border-transparent bg-gradient-to-br from-sc2-blue/0 via-transparent to-sc2-purple/0 group-hover:from-sc2-blue/20 group-hover:to-sc2-purple/20 transition-all duration-300 pointer-events-none" />
    </motion.div>
  );
}

// ============================================
// SECTION 3: TIMELINE CHARTS SHOWCASE
// ============================================

function TimelineChartsSection() {
  return (
    <section className="py-32 px-4 relative mesh-gradient">
      <div className="max-w-6xl mx-auto">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Track Every Moment
          </h2>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            Real-time performance charts show exactly when you fell behind or pulled ahead
          </p>
        </motion.div>

        {/* Side by side chart showcases */}
        <div className="grid md:grid-cols-2 gap-8">
          <motion.div
            className="glass-card rounded-2xl overflow-hidden"
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            whileHover={{ y: -5 }}
          >
            <img
              src="/assets/screenshots/worker-chart-closeup.png"
              alt="Worker Count Timeline"
              className="w-full"
            />
            <div className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-yellow-400" />
                </div>
                <h3 className="text-xl font-bold text-white">Worker Count</h3>
              </div>
              <p className="text-slate-400">Compare your economy timing against pro benchmarks</p>
            </div>
          </motion.div>

          <motion.div
            className="glass-card rounded-2xl overflow-hidden"
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            whileHover={{ y: -5 }}
          >
            <img
              src="/assets/screenshots/army-chart-closeup.png"
              alt="Army Value Timeline"
              className="w-full"
            />
            <div className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center">
                  <Target className="w-5 h-5 text-red-400" />
                </div>
                <h3 className="text-xl font-bold text-white">Army Value</h3>
              </div>
              <p className="text-slate-400">Track military power throughout every engagement</p>
            </div>
          </motion.div>
        </div>

        {/* Feature highlights */}
        <motion.div
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <FeatureHighlight label="Pro Comparison" />
          <FeatureHighlight label="Range Bands" />
          <FeatureHighlight label="Key Moments" />
          <FeatureHighlight label="Multi-Game Average" />
        </motion.div>
      </div>
    </section>
  );
}

function FeatureHighlight({ label }: { label: string }) {
  return (
    <div className="glass rounded-lg px-4 py-3 text-center">
      <span className="text-sm text-slate-300">{label}</span>
    </div>
  );
}

// ============================================
// SECTION 4: DECISION ANALYSIS SHOWCASE
// ============================================

function DecisionAnalysisSection() {
  return (
    <section className="py-32 px-4 relative">
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Text content */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Understand Your
              <span className="text-sc2-purple"> Decisions</span>
            </h2>
            <p className="text-xl text-slate-400 mb-8">
              Our AI analyzes your key decision points - tech choices, army composition,
              timing attacks - and compares them against what the pros would do.
            </p>

            <div className="space-y-4">
              <DecisionPoint
                time="5:00"
                label="Tech Path"
                yourChoice="Stargate"
                proChoice="Alternate path"
                verdict="Good Choice"
                positive
              />
              <DecisionPoint
                time="7:00"
                label="Army Comp"
                yourChoice="Adept-based (3 units)"
                proChoice="Oracle-based (1 unit)"
                verdict="Pro Approach Better"
                positive={false}
              />
            </div>
          </motion.div>

          {/* Screenshot */}
          <motion.div
            className="relative"
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-sc2-purple/20 to-sc2-blue/20 blur-3xl -z-10" />
            <div className="glass-card rounded-2xl overflow-hidden">
              <img
                src="/assets/screenshots/strategic-decision-analysis-complete.png"
                alt="Decision Analysis"
                className="w-full"
              />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function DecisionPoint({
  time,
  label,
  yourChoice,
  proChoice,
  verdict,
  positive,
}: {
  time: string;
  label: string;
  yourChoice: string;
  proChoice: string;
  verdict: string;
  positive: boolean;
}) {
  return (
    <motion.div
      className="glass-card rounded-xl p-4"
      whileHover={{ x: 5 }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <span className="text-sc2-blue font-mono font-bold">{time}</span>
          <span className="text-white font-semibold">{label}</span>
        </div>
        <span className={`text-sm px-3 py-1 rounded-full ${positive ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
          {verdict}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="bg-sc2-blue/10 rounded-lg p-2">
          <div className="text-slate-500 text-xs mb-1">Your Choice</div>
          <div className="text-slate-300">{yourChoice}</div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-2">
          <div className="text-slate-500 text-xs mb-1">Pro Choice</div>
          <div className="text-slate-300">{proChoice}</div>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================
// SECTION 5: RACE SHOWCASE
// ============================================

function RaceShowcaseSection() {
  const [hoveredRace, setHoveredRace] = useState<string | null>(null);

  return (
    <section className="py-32 px-4 relative overflow-hidden">
      <div className="max-w-6xl mx-auto">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Built for Every Race
          </h2>
          <p className="text-xl text-slate-400">
            Tailored analysis for your playstyle
          </p>
        </motion.div>

        {/* Race Cards */}
        <div className="flex flex-col md:flex-row gap-6">
          <RaceCard
            race="Terran"
            icon="T"
            tagline="Mechanical Precision"
            color="from-blue-500 to-cyan-500"
            pattern="terran-pattern"
            bgColor="bg-blue-500/5"
            isHovered={hoveredRace === 'Terran'}
            isOtherHovered={hoveredRace !== null && hoveredRace !== 'Terran'}
            onHover={() => setHoveredRace('Terran')}
            onLeave={() => setHoveredRace(null)}
          />
          <RaceCard
            race="Zerg"
            icon="Z"
            tagline="Adaptive Evolution"
            color="from-purple-500 to-pink-500"
            pattern="zerg-pattern"
            bgColor="bg-purple-500/5"
            isHovered={hoveredRace === 'Zerg'}
            isOtherHovered={hoveredRace !== null && hoveredRace !== 'Zerg'}
            onHover={() => setHoveredRace('Zerg')}
            onLeave={() => setHoveredRace(null)}
          />
          <RaceCard
            race="Protoss"
            icon="P"
            tagline="Elegant Power"
            color="from-yellow-400 to-amber-500"
            pattern="protoss-pattern"
            bgColor="bg-yellow-500/5"
            isHovered={hoveredRace === 'Protoss'}
            isOtherHovered={hoveredRace !== null && hoveredRace !== 'Protoss'}
            onHover={() => setHoveredRace('Protoss')}
            onLeave={() => setHoveredRace(null)}
          />
        </div>
      </div>
    </section>
  );
}

function RaceCard({
  race,
  icon,
  tagline,
  color,
  pattern,
  bgColor,
  isHovered,
  isOtherHovered,
  onHover,
  onLeave,
}: {
  race: string;
  icon: string;
  tagline: string;
  color: string;
  pattern: string;
  bgColor: string;
  isHovered: boolean;
  isOtherHovered: boolean;
  onHover: () => void;
  onLeave: () => void;
}) {
  return (
    <motion.div
      className={`relative flex-1 min-h-[300px] rounded-2xl overflow-hidden glass-card ${pattern} transition-all duration-500 cursor-pointer`}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      animate={{
        flex: isHovered ? 1.5 : isOtherHovered ? 0.75 : 1,
      }}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
    >
      <div className={`absolute inset-0 ${bgColor} transition-opacity duration-300 ${isHovered ? 'opacity-100' : 'opacity-50'}`} />

      <div className="relative z-10 h-full flex flex-col items-center justify-center p-8 text-center">
        <motion.div
          className={`w-24 h-24 bg-gradient-to-br ${color} rounded-full flex items-center justify-center text-white text-4xl font-bold mb-6 shadow-2xl`}
          animate={{
            scale: isHovered ? 1.1 : 1,
            boxShadow: isHovered
              ? '0 0 40px rgba(255,255,255,0.3)'
              : '0 0 20px rgba(0,0,0,0.3)',
          }}
        >
          {icon}
        </motion.div>

        <h3 className="text-2xl font-bold text-white mb-2">{race}</h3>
        <p className="text-slate-400">{tagline}</p>

        <motion.div
          className="mt-4 overflow-hidden"
          animate={{
            height: isHovered ? 'auto' : 0,
            opacity: isHovered ? 1 : 0,
          }}
          transition={{ duration: 0.3 }}
        >
          <ul className="text-sm text-slate-300 space-y-1">
            <li>Build order analysis</li>
            <li>Timing benchmarks</li>
            <li>Pro match comparison</li>
          </ul>
        </motion.div>
      </div>
    </motion.div>
  );
}

// ============================================
// SECTION 6: PREMIUM CTA
// ============================================

function PremiumCTASection({ onRegister }: { onRegister: () => void }) {
  return (
    <section className="py-32 px-4 relative mesh-gradient-intense overflow-hidden">
      {/* Floating sparkles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-white rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              scale: [0, 1, 0],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: 2 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 2,
            }}
          />
        ))}
      </div>

      <div className="max-w-4xl mx-auto text-center relative z-10">
        {/* Main CTA Card */}
        <motion.div
          className="glass-strong rounded-3xl p-12 mb-12"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-5xl md:text-6xl font-bold text-white mb-6">
            Ready to Play Like a Pro?
          </h2>

          <motion.button
            onClick={onRegister}
            className="group relative px-12 py-5 rounded-xl font-semibold text-xl overflow-hidden rainbow-border rainbow-border-glow"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <span className="relative text-white flex items-center gap-3 justify-center">
              <Sparkles className="w-6 h-6" />
              Start Analyzing Free
            </span>
          </motion.button>

          <p className="text-slate-400 mt-6">No credit card required</p>
        </motion.div>

        {/* Scrolling Stats Ticker */}
        <div className="overflow-hidden mb-16 py-4 border-y border-white/5">
          <div className="flex gap-12 animate-scroll-left">
            {[...Array(2)].map((_, setIndex) => (
              <div key={setIndex} className="flex gap-12 shrink-0">
                <TickerItem text="12,847 games analyzed" />
                <TickerItem text="94% find actionable insights" />
                <TickerItem text="<3s average analysis time" />
                <TickerItem text="10,000+ pro replays" />
                <TickerItem text="All 3 races supported" />
              </div>
            ))}
          </div>
        </div>

        {/* Floating Testimonials */}
        <div className="flex flex-wrap justify-center gap-6">
          <TestimonialCard
            quote="Finally understand why I lose"
            rank="Bronze"
            delay={0}
          />
          <TestimonialCard
            quote="This helped me hit Diamond"
            rank="Gold"
            delay={0.2}
          />
          <TestimonialCard
            quote="Tournament-level analysis"
            rank="Masters"
            delay={0.4}
          />
        </div>
      </div>
    </section>
  );
}

function TickerItem({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 text-slate-400 whitespace-nowrap">
      <BarChart3 className="w-4 h-4 text-sc2-blue" />
      <span>{text}</span>
    </div>
  );
}

function TestimonialCard({ quote, rank, delay }: { quote: string; rank: string; delay: number }) {
  return (
    <motion.div
      className="glass-card rounded-xl p-6 max-w-xs animate-bob"
      style={{ animationDelay: `${delay}s` }}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay }}
    >
      <p className="text-white mb-3">"{quote}"</p>
      <p className="text-sm text-slate-400">- {rank} League Player</p>
    </motion.div>
  );
}

// ============================================
// MAIN LANDING PAGE COMPONENT
// ============================================

export default function LandingPage({ onLogin, onRegister }: LandingPageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: containerRef });
  const backgroundY = useTransform(scrollYProgress, [0, 1], ['0%', '30%']);

  return (
    <div ref={containerRef} className="min-h-screen bg-[#0a0e17] overflow-x-hidden">
      {/* Animated background that moves with scroll */}
      <motion.div
        className="fixed inset-0 pointer-events-none"
        style={{ y: backgroundY }}
      >
        <div className="absolute top-0 left-1/4 w-[1000px] h-[1000px] bg-sc2-blue/5 rounded-full blur-[200px]" />
        <div className="absolute bottom-0 right-1/4 w-[800px] h-[800px] bg-sc2-purple/5 rounded-full blur-[200px]" />
      </motion.div>

      <HeroSection onLogin={onLogin} onRegister={onRegister} />
      <BentoGridSection />
      <TimelineChartsSection />
      <DecisionAnalysisSection />
      <RaceShowcaseSection />
      <PremiumCTASection onRegister={onRegister} />

      {/* Footer */}
      <footer className="py-8 border-t border-white/5 relative z-10">
        <div className="max-w-6xl mx-auto px-4 text-center text-slate-500">
          <p>SC2 Replay Analyzer - Compare your play to the pros</p>
        </div>
      </footer>
    </div>
  );
}

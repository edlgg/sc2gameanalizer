import { useRef, useEffect, useCallback } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

function formatStat(n: number): string {
  if (n >= 1000000) return Math.round(n / 1000000).toLocaleString() + 'M+';
  if (n >= 1000) return Math.round(n / 1000).toLocaleString() + 'K+';
  return n.toLocaleString();
}

interface LandingPageProps {
  onLogin: () => void;
  onRegister: () => void;
}

// ============================================
// UTILITY: Split text into character spans
// ============================================
function SplitChars({ text, className }: { text: string; className?: string }) {
  return (
    <span className={className}>
      {text.split('').map((char, i) => (
        <span
          key={i}
          className="ed-char"
          data-char-index={i}
        >
          {char === ' ' ? '\u00A0' : char}
        </span>
      ))}
    </span>
  );
}

// ============================================
// SECTION 1: HERO
// ============================================
function HeroSection({ onRegister }: { onRegister: () => void }) {
  const heroRef = useRef<HTMLElement>(null);
  const magneticRef = useRef<HTMLDivElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const editionRef = useRef<HTMLDivElement>(null);
  const scrollIndicatorRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLButtonElement>(null);
  const freeBadgeRef = useRef<HTMLDivElement>(null);
  const ctaSubtextRef = useRef<HTMLDivElement>(null);

  // Hero entrance animations
  useGSAP(() => {
    const tl = gsap.timeline({ delay: 0.5 });

    tl.to(freeBadgeRef.current, {
      opacity: 1, duration: 0.8, ease: 'power2.out',
    })
    .to('.ed-hero-title-line:nth-child(1) .word-inner', {
      y: 0, duration: 1.2, ease: 'power4.out',
    }, '-=0.5')
    .to('.ed-hero-title-line:nth-child(2) .word-inner', {
      y: 0, duration: 1.2, ease: 'power4.out',
    }, '-=0.9')
    .to('.ed-hero-title-line:nth-child(3) .word-inner', {
      y: 0, duration: 1.2, ease: 'power4.out',
    }, '-=0.9')
    .to(subtitleRef.current, {
      opacity: 1, duration: 1, ease: 'power2.out',
    }, '-=0.5')
    .to(editionRef.current, {
      opacity: 1, duration: 0.8, ease: 'power2.out',
    }, '-=0.3')
    .to(scrollIndicatorRef.current, {
      opacity: 1, duration: 0.8, ease: 'power2.out',
    }, '-=0.3');

    // Hide scroll indicator on scroll
    ScrollTrigger.create({
      trigger: heroRef.current,
      start: 'top top',
      end: '+=200',
      onLeave: () => gsap.to(scrollIndicatorRef.current, { opacity: 0, duration: 0.3 }),
      onEnterBack: () => gsap.to(scrollIndicatorRef.current, { opacity: 1, duration: 0.3 }),
    });

    // CTA entrance
    gsap.from(ctaRef.current, {
      opacity: 0, y: 20, duration: 1, ease: 'power3.out', delay: 2,
    });
    gsap.from(ctaSubtextRef.current, {
      opacity: 0, y: 10, duration: 0.8, ease: 'power3.out', delay: 2.2,
    });

    // Stats counter animation
    heroRef.current?.querySelectorAll<HTMLElement>('.ed-hero-stat-number[data-count]').forEach(el => {
      const target = parseInt(el.dataset.count || '0');
      ScrollTrigger.create({
        trigger: el,
        start: 'top 85%',
        once: true,
        onEnter: () => {
          gsap.to(el, {
            innerText: target,
            duration: 2,
            ease: 'power2.out',
            snap: { innerText: 1 },
            onUpdate() {
              el.innerText = formatStat(Math.round(parseFloat(el.innerText)));
            },
          });
        },
      });
    });

    // Badge pulse
    gsap.to('.ed-hero-image-badge', {
      opacity: 0.7, duration: 1.5, repeat: -1, yoyo: true, ease: 'sine.inOut',
    });
  }, { scope: heroRef });

  // Magnetic effect on hero image
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!magneticRef.current) return;
    const rect = magneticRef.current.getBoundingClientRect();
    const distX = (e.clientX - (rect.left + rect.width / 2)) * 0.03;
    const distY = (e.clientY - (rect.top + rect.height / 2)) * 0.03;
    gsap.to(magneticRef.current, {
      x: distX, y: distY + 20, rotation: -3 + distX * 0.05,
      duration: 0.8, ease: 'power3.out',
    });
  }, []);

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, [handleMouseMove]);

  return (
    <section ref={heroRef} className="ed-hero" id="hero">
      <div className="ed-hero-bg-grid" />
      <div className="ed-hero-bg-gradient" />

      <div ref={freeBadgeRef} className="ed-hero-free-badge">
        FREE TIER — 3 UPLOADS/MONTH — NO INFORMATION REQUIRED
      </div>

      <div ref={editionRef} className="ed-hero-edition-label">
        COMPETITIVE ANALYSIS PLATFORM — STARCRAFT II
      </div>

      <div className="ed-hero-inner">
        <div className="ed-hero-text">
          <span className="ed-hero-title-line">
            <span className="word-inner">LEVEL UP</span>
          </span>
          <span className="ed-hero-title-line">
            <span className="word-inner">YOUR</span>
          </span>
          <span className="ed-hero-title-line">
            <span className="word-inner">STARCRAFT II</span>
          </span>
        </div>
        <div className="ed-hero-image-wrap">
          <div ref={magneticRef} className="ed-hero-image-magnetic" style={{ transform: 'rotate(-3deg) translateY(20px)' }}>
            <img
              src="/assets/screenshots/hero-radar-comparison.png"
              alt="Radar comparison chart showing player metrics versus professional benchmarks"
            />
            <div className="ed-hero-image-badge">PRO COMPARISON</div>
          </div>
        </div>
      </div>

      <p ref={subtitleRef} className="ed-hero-subtitle">
        Upload replays. Compare to pros. Learn why you're falling behind.
      </p>

      <div ref={scrollIndicatorRef} className="ed-hero-scroll-indicator">
        <span>SCROLL</span>
        <div className="ed-hero-scroll-line" />
      </div>

      <div className="ed-hero-stats">
        {[
          { count: 10000, label: 'Data Points Per Game' },
          { count: 850, label: 'Pro Replays Analyzed' },
          { count: 23, label: 'Metrics Tracked' },
          { count: 1, label: 'Sub-Second Analysis' },
        ].map(stat => (
          <div key={stat.label} className="flex flex-col">
            <span className="ed-hero-stat-number" data-count={stat.count}>0</span>
            <span className="ed-hero-stat-label">{stat.label}</span>
          </div>
        ))}
      </div>

      <div className="ed-hero-cta-wrap">
        <button ref={ctaRef} className="ed-hero-cta" onClick={onRegister}>
          GET STARTED FREE →
        </button>
        <div ref={ctaSubtextRef} className="ed-cta-subtext">
          No information required • 3 uploads/month
        </div>
      </div>

      <div className="ed-hero-divider" />
    </section>
  );
}

// ============================================
// EDITORIAL DIVIDER
// ============================================
function EditorialDivider({ text }: { text: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const lines = ref.current?.querySelectorAll('.ed-divider-line');
    const textEl = ref.current?.querySelector('.ed-divider-text');

    if (lines) {
      gsap.fromTo(lines, { scaleX: 0 }, {
        scaleX: 1, duration: 1.2, ease: 'power3.out',
        scrollTrigger: { trigger: ref.current, start: 'top 85%', toggleActions: 'play none none none' },
      });
    }
    if (textEl) {
      gsap.fromTo(textEl, { opacity: 0 }, {
        opacity: 1, duration: 0.8, ease: 'power2.out',
        scrollTrigger: { trigger: ref.current, start: 'top 85%', toggleActions: 'play none none none' },
        delay: 0.4,
      });
    }
  }, { scope: ref });

  return (
    <div ref={ref} className="ed-divider">
      <div className="ed-divider-line" />
      <div className="ed-divider-text">{text}</div>
      <div className="ed-divider-line" />
    </div>
  );
}

// ============================================
// SECTION 2: FEATURES — MAGAZINE SPREAD
// ============================================
const featureItems = [
  { num: '01', image: '/assets/screenshots/game-overview-pvp.png', title: 'Complete Game Overview', desc: 'Every metric at a glance. Map control, economy, army value, and more in a single view.', tags: ['Dashboard', 'Real-time'], cls: 'ed-feature-item-1' },
  { num: '02', image: '/assets/screenshots/comparison-matrix-pvt.png', title: 'Comparison Matrix', desc: 'Head-to-head metric analysis against professional benchmarks.', tags: ['Comparison', '23 Metrics'], cls: 'ed-feature-item-2' },
  { num: '03', image: '/assets/screenshots/combat-trade-zvp.png', title: 'Combat Trade Analysis', desc: 'Understand the value exchanges in every engagement throughout the game.', tags: ['Combat', 'Engagement'], cls: 'ed-feature-item-3' },
  { num: '04', image: '/assets/screenshots/cumulative-spending-pvp.png', title: 'Spending Patterns', desc: 'Track how resources flow across the entire game. Compare your spending habits to the pros.', tags: ['Economy', 'Resources'], cls: 'ed-feature-item-4' },
];

function FeaturesSection() {
  const ref = useRef<HTMLElement>(null);
  const textCardRef = useRef<HTMLDivElement>(null);
  const textCardNumberRef = useRef<HTMLDivElement>(null);
  const pricingCalloutRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    // Header characters
    ref.current?.querySelectorAll<HTMLElement>('.ed-features-header-line .ed-char').forEach((char, i) => {
      gsap.to(char, {
        opacity: 1, y: 0, rotation: 0, duration: 0.6, ease: 'power3.out',
        scrollTrigger: { trigger: '.ed-features-header', start: 'top 80%', toggleActions: 'play none none none' },
        delay: i * 0.03,
      });
    });

    // Callouts
    ref.current?.querySelectorAll<HTMLElement>('.ed-feature-callout').forEach(el => {
      gsap.to(el, {
        opacity: 1, y: 0, duration: 1, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 85%', toggleActions: 'play none none none' },
      });
    });

    // Pricing callout
    if (pricingCalloutRef.current) {
      gsap.to(pricingCalloutRef.current, {
        opacity: 1, y: 0, duration: 1, ease: 'power3.out',
        scrollTrigger: { trigger: pricingCalloutRef.current, start: 'top 85%', toggleActions: 'play none none none' },
      });
    }

    // Feature items
    ref.current?.querySelectorAll<HTMLElement>('.ed-feature-item').forEach((item, index) => {
      const isOdd = index % 2 === 1;
      const rotations = [2, -3, 1, -1];
      gsap.fromTo(item,
        { opacity: 0, x: isOdd ? 80 : -80, rotation: isOdd ? -3 : 3 },
        {
          opacity: 1, x: 0, rotation: rotations[index], duration: 1.2, ease: 'power3.out',
          scrollTrigger: { trigger: item, start: 'top 85%', toggleActions: 'play none none none' },
        }
      );
    });

    // Feature text card
    if (textCardRef.current) {
      gsap.fromTo(textCardRef.current,
        { opacity: 0, scale: 0.9 },
        {
          opacity: 1, scale: 1, duration: 1, ease: 'power3.out',
          scrollTrigger: { trigger: textCardRef.current, start: 'top 85%', toggleActions: 'play none none none' },
        }
      );

      // Border glow
      ScrollTrigger.create({
        trigger: textCardRef.current,
        start: 'top 80%',
        end: 'bottom 20%',
        onEnter: () => { if (textCardRef.current) textCardRef.current.style.borderColor = 'var(--ed-blue)'; },
        onLeave: () => { if (textCardRef.current) textCardRef.current.style.borderColor = 'var(--ed-gray-mid)'; },
        onEnterBack: () => { if (textCardRef.current) textCardRef.current.style.borderColor = 'var(--ed-blue)'; },
        onLeaveBack: () => { if (textCardRef.current) textCardRef.current.style.borderColor = 'var(--ed-gray-mid)'; },
      });
    }

    // Counter
    if (textCardNumberRef.current) {
      ScrollTrigger.create({
        trigger: textCardNumberRef.current,
        start: 'top 85%',
        once: true,
        onEnter: () => {
          gsap.to(textCardNumberRef.current, {
            innerText: 500000,
            duration: 2.5,
            ease: 'power2.out',
            snap: { innerText: 1 },
            onUpdate() {
              if (textCardNumberRef.current) {
                textCardNumberRef.current.innerText = formatStat(Math.round(parseFloat(textCardNumberRef.current.innerText)));
              }
            },
          });
        },
      });
    }

    // Background text parallax
    gsap.to('.ed-features-bg-text', {
      y: -100, ease: 'none',
      scrollTrigger: { trigger: ref.current, start: 'top bottom', end: 'bottom top', scrub: true },
    });

    // Feature number parallax
    ref.current?.querySelectorAll('.ed-feature-number').forEach(num => {
      gsap.to(num, {
        y: -60, ease: 'none',
        scrollTrigger: { trigger: num, start: 'top bottom', end: 'bottom top', scrub: true },
      });
    });

    // Feature image parallax
    ref.current?.querySelectorAll<HTMLElement>('.ed-feature-item img').forEach((img, i) => {
      const dir = i % 2 === 0 ? 1 : -1;
      gsap.fromTo(img, { y: 30 * dir }, {
        y: -30 * dir, ease: 'none',
        scrollTrigger: { trigger: img, start: 'top bottom', end: 'bottom top', scrub: true },
      });
    });
  }, { scope: ref });

  // Image tilt on hover
  const handleImageMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    gsap.to(el, { rotateY: x * 5, rotateX: -y * 5, duration: 0.6, ease: 'power2.out', transformPerspective: 800 });
  }, []);

  const handleImageMouseLeave = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    gsap.to(e.currentTarget, { rotateY: 0, rotateX: 0, duration: 0.8, ease: 'elastic.out(1, 0.5)' });
  }, []);

  return (
    <section ref={ref} className="ed-features" id="features">
      <div className="ed-features-bg-text">ANALYZED</div>

      <div className="ed-features-header">
        <span className="ed-features-header-line"><SplitChars text="EVERY" /></span>
        <span className="ed-features-header-line"><SplitChars text="THING" /></span>
        <span className="ed-features-header-line"><SplitChars text="YOU NEED" /></span>
      </div>

      {/* First callout */}
      <div className="ed-feature-callout">
        FULL GAME <span className="accent">OVERVIEW</span>
      </div>

      <div className="ed-features-masonry">
        {featureItems.map((feat, i) => (
          <div key={feat.num}>
            {/* Callout after feature 0 */}
            {i === 1 && (
              <div className="ed-feature-callout right">
                SIDE-BY-SIDE <span className="accent">METRICS</span>
              </div>
            )}

            <div className={`ed-feature-item ${feat.cls}`}>
              <div className="ed-feature-image-wrap" onMouseMove={handleImageMouseMove} onMouseLeave={handleImageMouseLeave}>
                <span className="ed-feature-number">{feat.num}</span>
                <img src={feat.image} alt={feat.title} />
              </div>
              <div className="ed-feature-title">{feat.title}</div>
              <div className="ed-feature-desc">{feat.desc}</div>
              <div className="ed-feature-meta">
                {feat.tags.map((tag, j) => (
                  <span key={tag}>
                    {j > 0 && <span className="ed-feature-meta-dot" />}
                    <span className="ed-feature-meta-tag">{tag}</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Callout after feature 2 */}
            {i === 2 && (
              <div className="ed-feature-callout">
                ECONOMIC <span className="accent">INTELLIGENCE</span>
              </div>
            )}
          </div>
        ))}
      </div>

      <div ref={pricingCalloutRef} className="ed-pricing-callout">
        START FREE — 3 UPLOADS/MONTH
        <div className="divider" />
        UPGRADE ANYTIME — <span className="price">$29.99</span> ONE-TIME FOR UNLIMITED
      </div>

      <div ref={textCardRef} className="ed-feature-text-card">
        <div ref={textCardNumberRef} className="ed-feature-text-card-number" data-count="1200">0</div>
        <div className="ed-feature-text-card-label">GAMES ANALYZED & COUNTING</div>
      </div>
    </section>
  );
}

// ============================================
// SECTION 3: TIMELINE
// ============================================
function TimelineSection() {
  const ref = useRef<HTMLElement>(null);

  useGSAP(() => {
    // Header chars
    ref.current?.querySelectorAll<HTMLElement>('.ed-timeline-header-line .ed-char').forEach((char, i) => {
      gsap.fromTo(char,
        { opacity: 0, y: 40, rotation: 5 },
        {
          opacity: 1, y: 0, rotation: 0, duration: 0.6, ease: 'power3.out',
          scrollTrigger: { trigger: '.ed-timeline-header', start: 'top 80%', toggleActions: 'play none none none' },
          delay: i * 0.02,
        }
      );
    });

    // Image blocks
    ref.current?.querySelectorAll<HTMLElement>('.ed-timeline-image-block').forEach((block, index) => {
      gsap.fromTo(block,
        { opacity: 0, y: 80, rotation: index === 0 ? 3 : -3 },
        {
          opacity: 1, y: 0, rotation: index === 0 ? 1 : -1, duration: 1.2, ease: 'power3.out',
          scrollTrigger: { trigger: block, start: 'top 85%', toggleActions: 'play none none none' },
          delay: index * 0.2,
        }
      );

      // Drift parallax
      gsap.fromTo(block, { x: index === 0 ? -20 : 20 }, {
        x: index === 0 ? 20 : -20, ease: 'none',
        scrollTrigger: { trigger: block, start: 'top bottom', end: 'bottom top', scrub: true },
      });
    });

    // Feature labels chars
    ref.current?.querySelectorAll<HTMLElement>('.ed-timeline-feature-item .ed-char').forEach((char, i) => {
      gsap.fromTo(char, { opacity: 0 }, {
        opacity: 1, duration: 0.4, ease: 'power2.out',
        scrollTrigger: { trigger: '.ed-timeline-features-row', start: 'top 85%', toggleActions: 'play none none none' },
        delay: i * 0.02,
      });
    });

    // Bg number parallax
    gsap.to('.ed-timeline-bg-number', {
      y: -100, ease: 'none',
      scrollTrigger: { trigger: ref.current, start: 'top bottom', end: 'bottom top', scrub: true },
    });
  }, { scope: ref });

  return (
    <section ref={ref} className="ed-timeline" id="timeline">
      <div className="ed-timeline-bg-number">03</div>
      <div className="ed-timeline-divider-top" />

      <div className="ed-timeline-header">
        <span className="ed-timeline-header-line"><SplitChars text="TRACK" /></span>
        <span className="ed-timeline-header-line"><SplitChars text="EVERY" /></span>
        <span className="ed-timeline-header-line"><SplitChars text="MOMENT" /></span>
      </div>

      <div className="ed-timeline-images">
        <div className="ed-timeline-image-block">
          <img src="/assets/screenshots/worker-chart-pvt.png" alt="Worker count timeline" />
          <div className="ed-timeline-image-label">Worker Count</div>
          <div className="ed-timeline-image-desc">Track your worker production against professional benchmarks. See exactly where you fall behind in economy.</div>
        </div>
        <div className="ed-timeline-image-block">
          <img src="/assets/screenshots/army-chart-zvp.png" alt="Army value over time" />
          <div className="ed-timeline-image-label">Army Value</div>
          <div className="ed-timeline-image-desc">Monitor military investment timing. Understand when pros commit to army and when they prioritize economy.</div>
        </div>
      </div>

      <div className="ed-timeline-features-row">
        {['PRO COMPARISON', 'RANGE BANDS', 'KEY MOMENTS', 'MULTI-GAME'].map(label => (
          <div key={label} className="ed-timeline-feature-item">
            <SplitChars text={label} />
          </div>
        ))}
      </div>
    </section>
  );
}

// ============================================
// SECTION 3.5: PROCESS
// ============================================
const processSteps = [
  { num: '01', title: 'UPLOAD YOUR REPLAY', desc: 'Drop any .SC2Replay file into the analyzer — free accounts get 3 uploads per month. Every matchup, every map, every game length. Your replay is parsed into 5-second snapshots — generating over 10,000 data points per game.' },
  { num: '02', title: 'FIND PRO MATCHES', desc: 'Our ML-powered similarity engine matches your gameplay against 500K+ professional data points using 51 distinct features. Rule-based and embedding-based matching work together.' },
  { num: '03', title: 'COMPARE & LEARN', desc: 'Side-by-side dashboards with 15+ analysis tools reveal exactly where your gameplay diverges from tournament-level play. Timelines, efficiency metrics, and strategic decision analysis.' },
];

function ProcessSection() {
  const ref = useRef<HTMLElement>(null);

  useGSAP(() => {
    ref.current?.querySelectorAll<HTMLElement>('.ed-process-header-line .ed-char').forEach((char, i) => {
      gsap.to(char, {
        opacity: 1, y: 0, duration: 0.6, ease: 'power3.out',
        scrollTrigger: { trigger: '.ed-process-header', start: 'top 80%', toggleActions: 'play none none none' },
        delay: i * 0.03,
      });
    });

    ref.current?.querySelectorAll<HTMLElement>('.ed-process-step').forEach((step, index) => {
      gsap.to(step, {
        opacity: 1, x: 0, duration: 1, ease: 'power3.out',
        scrollTrigger: { trigger: step, start: 'top 85%', toggleActions: 'play none none none' },
        delay: index * 0.2,
      });
    });
  }, { scope: ref });

  return (
    <section ref={ref} className="ed-process" id="process">
      <div className="ed-process-header">
        <span className="ed-process-header-line"><SplitChars text="THE" /></span>
        <span className="ed-process-header-line ed-process-header-outlined"><SplitChars text="PROCESS" /></span>
      </div>

      <div className="ed-process-steps">
        {processSteps.map((step, i) => (
          <div key={step.num} className="ed-process-step">
            <div className="ed-process-step-number">{step.num}</div>
            <div className="ed-process-step-content">
              <h3 className="ed-process-step-title">{step.title}</h3>
              <p className="ed-process-step-desc">{step.desc}</p>
            </div>
            {i < processSteps.length - 1 && <div className="ed-process-step-line" />}
          </div>
        ))}
      </div>
    </section>
  );
}

// ============================================
// SECTION 4: STRATEGIC DECISIONS
// ============================================
const decisionQuotes = [
  { text: 'You took your third base 45 seconds later than the pro average for this matchup.', detail: 'Base timing analysis identifies macro timing gaps' },
  { text: 'Your army peaked at 8:30 but the engagement happened at 9:15 with 15% less value.', detail: 'Army composition tracking pinpoints costly delays' },
  { text: 'Pro players in this position maintain 20% higher worker count through the midgame.', detail: 'Economic benchmarks reveal hidden inefficiencies' },
];

function DecisionsSection() {
  const ref = useRef<HTMLElement>(null);

  useGSAP(() => {
    gsap.to('.ed-decisions-title-small', {
      opacity: 1, duration: 1, ease: 'power3.out',
      scrollTrigger: { trigger: ref.current, start: 'top 70%', toggleActions: 'play none none none' },
    });
    gsap.to('.ed-decisions-title-big', {
      opacity: 1, duration: 1, ease: 'power3.out',
      scrollTrigger: { trigger: ref.current, start: 'top 70%', toggleActions: 'play none none none' },
      delay: 0.2,
    });

    ref.current?.querySelectorAll<HTMLElement>('.ed-decision-quote').forEach((quote, index) => {
      gsap.to(quote, {
        opacity: 1, x: 0, duration: 0.8, ease: 'power3.out',
        scrollTrigger: { trigger: quote, start: 'top 85%', toggleActions: 'play none none none' },
        delay: index * 0.15,
      });
    });

    gsap.fromTo('.ed-decisions-image',
      { opacity: 0, scale: 0.9, rotation: -4 },
      {
        opacity: 1, scale: 1, rotation: 0, duration: 1.2, ease: 'power3.out',
        scrollTrigger: { trigger: '.ed-decisions-image', start: 'top 80%', toggleActions: 'play none none none' },
      }
    );

    gsap.fromTo('.ed-decisions-image img', { y: 40 }, {
      y: -40, ease: 'none',
      scrollTrigger: { trigger: '.ed-decisions-image', start: 'top bottom', end: 'bottom top', scrub: true },
    });
  }, { scope: ref });

  return (
    <section ref={ref} className="ed-decisions" id="decisions">
      <div className="ed-decisions-bg-pattern" />
      <div className="ed-decisions-inner">
        <div className="ed-decisions-text">
          <div className="ed-decisions-title-small">UNDERSTAND YOUR</div>
          <div className="ed-decisions-title-big">DECISIONS</div>

          <div style={{ marginTop: '4rem' }}>
            {decisionQuotes.map((q, i) => (
              <div key={i} className="ed-decision-quote">
                <span className="ed-decision-quote-mark">&ldquo;</span>
                <div className="ed-decision-quote-text">{q.text}</div>
                <div className="ed-decision-quote-detail">{q.detail}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="ed-decisions-image">
          <img src="/assets/screenshots/strategic-decisions-zvp.png" alt="Strategic decision analysis" />
        </div>
      </div>
    </section>
  );
}

// ============================================
// SECTION 5: HORIZONTAL SCROLL SHOWCASE
// ============================================
const showcasePanels = [
  { image: '/assets/screenshots/milestones-timeline-zvp.png', alt: 'Milestone timeline' },
  { image: '/assets/screenshots/efficiency-comparison-zvp.png', alt: 'Efficiency comparison' },
  { image: '/assets/screenshots/supply-block-zvp.png', alt: 'Supply block analysis' },
  { image: '/assets/screenshots/win-probability-tvp.png', alt: 'Win probability' },
  { image: '/assets/screenshots/summary-stats-zvp.png', alt: 'Summary statistics' },
];

function ShowcaseSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const pinWrapRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!containerRef.current || !pinWrapRef.current) return;

    const container = containerRef.current;

    // Title entrance
    gsap.fromTo('.ed-showcase-title', { opacity: 0, y: 20 }, {
      opacity: 1, y: 0, duration: 1, ease: 'power3.out',
      scrollTrigger: { trigger: sectionRef.current, start: 'top 80%', toggleActions: 'play none none none' },
    });

    // Horizontal scroll
    const horizontalScroll = gsap.to(container, {
      x: () => -(container.scrollWidth - window.innerWidth),
      ease: 'none',
      scrollTrigger: {
        trigger: pinWrapRef.current,
        pin: true,
        scrub: 1,
        end: () => '+=' + (container.scrollWidth - window.innerWidth),
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          if (progressBarRef.current) {
            gsap.set(progressBarRef.current, { width: (self.progress * 100) + '%' });
          }
        },
      },
    });

    // Per-panel animations
    container.querySelectorAll<HTMLElement>('.ed-showcase-panel').forEach(panel => {
      const img = panel.querySelector('img');
      if (img) {
        gsap.fromTo(img, { scale: 1.1 }, {
          scale: 1, ease: 'none',
          scrollTrigger: {
            trigger: panel, containerAnimation: horizontalScroll,
            start: 'left right', end: 'left left', scrub: true,
          },
        });
      }

      panel.querySelectorAll('.ed-panel-overlay-text, .ed-panel-2-text, .ed-panel-4-side, .ed-panel-caption').forEach(textEl => {
        gsap.fromTo(textEl, { x: 60, opacity: 0 }, {
          x: 0, opacity: 1, ease: 'power2.out',
          scrollTrigger: {
            trigger: panel, containerAnimation: horizontalScroll,
            start: 'left 80%', end: 'left 40%', scrub: true,
          },
        });
      });
    });
  }, { scope: sectionRef });

  return (
    <section ref={sectionRef} className="ed-showcase" id="showcase">
      <div className="ed-showcase-title-bar">
        <h2 className="ed-showcase-title">DEEP <span className="accent">PERFORMANCE</span> INSIGHTS</h2>
      </div>

      <div className="ed-showcase-progress-wrap">
        <div className="ed-showcase-progress">
          <div ref={progressBarRef} className="ed-showcase-progress-bar" />
        </div>
      </div>

      <div ref={pinWrapRef} className="ed-showcase-pin-wrap">
        <div ref={containerRef} className="ed-showcase-container">
          {/* Panel 1: Milestones */}
          <div className="ed-showcase-panel ed-panel-1">
            <span className="ed-panel-number">01</span>
            <img src={showcasePanels[0].image} alt={showcasePanels[0].alt} />
            <div className="ed-panel-overlay-text" style={{ bottom: '10%', left: '5%' }}>MILESTONE<br />TRACKING</div>
            <div className="ed-showcase-panel-count">01 / 05</div>
            <div className="ed-showcase-panel-divider" />
          </div>

          {/* Panel 2: Efficiency */}
          <div className="ed-showcase-panel ed-panel-2">
            <div className="ed-panel-2-text">
              <h2>EFFI<br />CIENCY</h2>
              <p>Measure how effectively you convert resources into results. Compare your efficiency ratios against the top players in every matchup.</p>
            </div>
            <div className="ed-panel-2-image">
              <img src={showcasePanels[1].image} alt={showcasePanels[1].alt} />
            </div>
            <div className="ed-showcase-panel-count">02 / 05</div>
            <div className="ed-showcase-panel-divider" />
          </div>

          {/* Panel 3: Supply Block */}
          <div className="ed-showcase-panel ed-panel-3">
            <span className="ed-panel-bg-number">03</span>
            <img src={showcasePanels[2].image} alt={showcasePanels[2].alt} />
            <div className="ed-panel-caption">SUPPLY BLOCK ANALYSIS</div>
            <div className="ed-showcase-panel-count">03 / 05</div>
            <div className="ed-showcase-panel-divider" />
          </div>

          {/* Panel 4: Win Probability */}
          <div className="ed-showcase-panel ed-panel-4">
            <div className="ed-panel-4-content">
              <img src={showcasePanels[3].image} alt={showcasePanels[3].alt} />
              <div className="ed-panel-4-side">
                <h3>WIN<br /><span>PROBABILITY</span></h3>
                <p>Real-time win probability calculated from game state snapshots. See when the game was truly decided.</p>
              </div>
            </div>
            <div className="ed-showcase-panel-count">04 / 05</div>
            <div className="ed-showcase-panel-divider" />
          </div>

          {/* Panel 5: Summary */}
          <div className="ed-showcase-panel ed-panel-5">
            <div className="ed-panel-overlay-text" style={{ top: '12%', left: '8%' }}>
              <span>THE COMPLETE</span><br />
              <span className="blue">PICTURE</span>
            </div>
            <img src={showcasePanels[4].image} alt={showcasePanels[4].alt} />
            <div className="ed-showcase-panel-count">05 / 05</div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================
// SECTION 5.5: STATS RIBBON
// ============================================
const ribbonStats = [
  { count: 5, label: 'SECOND SNAPSHOT\nINTERVALS' },
  { count: 26, label: 'ECONOMIC\nINDICATORS' },
  { count: 15, label: 'VISUALIZATION\nTOOLS' },
  { count: 99, label: 'PARSE\nACCURACY %' },
  { count: 850, label: 'TOURNAMENT\nREPLAYS' },
];

function StatsRibbon() {
  const ref = useRef<HTMLElement>(null);

  useGSAP(() => {
    ref.current?.querySelectorAll<HTMLElement>('.ed-stats-ribbon-item').forEach((item, index) => {
      gsap.to(item, {
        opacity: 1, y: 0, duration: 0.8, ease: 'power3.out',
        scrollTrigger: { trigger: item, start: 'top 85%', toggleActions: 'play none none none' },
        delay: index * 0.1,
      });

      const numEl = item.querySelector<HTMLElement>('.ed-stats-ribbon-number');
      if (numEl?.dataset.count) {
        const target = parseInt(numEl.dataset.count);
        ScrollTrigger.create({
          trigger: numEl,
          start: 'top 85%',
          once: true,
          onEnter: () => {
            gsap.to(numEl, {
              innerText: target,
              duration: 2,
              ease: 'power2.out',
              snap: { innerText: 1 },
              onUpdate() { numEl.innerText = formatStat(Math.round(parseFloat(numEl.innerText))); },
            });
          },
        });
      }
    });
  }, { scope: ref });

  return (
    <section ref={ref} className="ed-stats-ribbon" id="statsRibbon">
      <div className="ed-stats-ribbon-inner">
        {ribbonStats.map((stat, i) => (
          <div key={stat.label}>
            {i > 0 && <div className="ed-stats-ribbon-divider" />}
            <div className="ed-stats-ribbon-item">
              <div className="ed-stats-ribbon-number" data-count={stat.count}>0</div>
              <div className="ed-stats-ribbon-label" dangerouslySetInnerHTML={{ __html: stat.label.replace('\n', '<br/>') }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ============================================
// SECTION 6: RACE SHOWCASE
// ============================================
const races = [
  { cls: 'terran', letter: 'T', name: 'TERRAN', tagline: '"Adapt. Overcome. Dominate."', bullets: ['Marine/Medivac timing analysis', 'Mech vs. Bio transition tracking', 'Orbital Command energy usage'] },
  { cls: 'zerg', letter: 'Z', name: 'ZERG', tagline: '"Evolve. Consume. Multiply."', bullets: ['Inject cycle efficiency metrics', 'Creep spread coverage tracking', 'Larva spending optimization'] },
  { cls: 'protoss', letter: 'P', name: 'PROTOSS', tagline: '"Power. Precision. Perfection."', bullets: ['Warp gate cooldown utilization', 'Chronoboost efficiency analysis', 'Gateway vs. Robo tech paths'] },
];

function RaceSection() {
  const ref = useRef<HTMLElement>(null);

  useGSAP(() => {
    ref.current?.querySelectorAll<HTMLElement>('.ed-race-column').forEach((col, index) => {
      gsap.to(col, {
        opacity: 1, y: 0, duration: 1, ease: 'power3.out',
        scrollTrigger: { trigger: col, start: 'top 85%', toggleActions: 'play none none none' },
        delay: index * 0.15,
      });
    });
  }, { scope: ref });

  // Hover dimming effect (JS for cross-browser support)
  const handleMouseEnter = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const cols = ref.current?.querySelectorAll<HTMLElement>('.ed-race-column');
    cols?.forEach(other => {
      if (other !== e.currentTarget) gsap.to(other, { opacity: 0.4, duration: 0.4, ease: 'power2.out' });
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    const cols = ref.current?.querySelectorAll<HTMLElement>('.ed-race-column');
    cols?.forEach(other => gsap.to(other, { opacity: 1, duration: 0.4, ease: 'power2.out' }));
  }, []);

  return (
    <section ref={ref} className="ed-races" id="races">
      <div className="ed-race-divider-top" />
      {races.map(race => (
        <div
          key={race.cls}
          className={`ed-race-column ${race.cls}`}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <span className="ed-race-letter">{race.letter}</span>
          <div className="ed-race-content">
            <div className="ed-race-name">{race.name}</div>
            <div className="ed-race-tagline">{race.tagline}</div>
            <div className="ed-race-icon-line" />
            <ul className="ed-race-bullets">
              {race.bullets.map(b => <li key={b}>{b}</li>)}
            </ul>
          </div>
        </div>
      ))}
    </section>
  );
}

// ============================================
// SECTION 7: CTA
// ============================================
const marqueeItems = [
  { text: 'INSTANT', cls: 'blue', suffix: ' INSIGHTS' },
  { text: 'EVERY', cls: 'blue', suffix: ' MATCHUP COVERED' },
  { text: '23', cls: 'highlight', suffix: ' TRACKED METRICS' },
  { text: 'TOURNAMENT', cls: 'highlight', suffix: ' PRO REPLAYS' },
  { text: 'REAL-TIME ', cls: '', prefix: true, suffix: 'WIN PROBABILITY', suffixCls: 'blue' },
  { text: 'BUILD ORDER', cls: 'highlight', suffix: ' ANALYSIS' },
  { text: 'ML-POWERED', cls: 'blue', suffix: ' MATCHING' },
  { text: 'PROFESSIONAL', cls: 'highlight', suffix: ' BENCHMARKS' },
];

const capabilities = [
  { text: 'Every replay is parsed into 5-second snapshots tracking 23 distinct metrics — workers, army value, resources, bases, upgrades, and more. Zero estimation, pure data.', label: 'PRECISION PARSING' },
  { text: 'ML-powered similarity engine analyzes 51 features across your gameplay to find the closest professional matches. Dual-mode matching combines rules and embeddings for accuracy.', label: 'INTELLIGENT MATCHING' },
  { text: 'Win probability curves, efficiency comparisons, combat trade analysis, supply block tracking, spending patterns — a complete analytical toolkit that turns data into actionable insights.', label: 'COMPREHENSIVE TOOLS' },
];

function CTASection({ onRegister }: { onRegister: () => void }) {
  const ref = useRef<HTMLElement>(null);
  const marqueeRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    // CTA title chars — random position assembly
    ref.current?.querySelectorAll<HTMLElement>('.ed-cta-title-line .ed-char').forEach((char, i) => {
      const rx = (Math.random() - 0.5) * 100;
      const ry = (Math.random() - 0.5) * 60;
      const rr = (Math.random() - 0.5) * 30;
      gsap.fromTo(char,
        { opacity: 0, x: rx, y: ry, rotation: rr },
        {
          opacity: 1, x: 0, y: 0, rotation: 0, duration: 0.8, ease: 'power3.out',
          scrollTrigger: { trigger: '.ed-cta-title-wrap', start: 'top 80%', toggleActions: 'play none none none' },
          delay: i * 0.02,
        }
      );
    });

    // CTA features
    ref.current?.querySelectorAll<HTMLElement>('.ed-cta-feature').forEach((feat, index) => {
      gsap.fromTo(feat, { opacity: 0, y: 30 }, {
        opacity: 1, y: 0, duration: 0.8, ease: 'power3.out',
        scrollTrigger: { trigger: feat, start: 'top 90%', toggleActions: 'play none none none' },
        delay: index * 0.1,
      });
    });

    // Capabilities
    ref.current?.querySelectorAll<HTMLElement>('.ed-capability').forEach((t, index) => {
      gsap.fromTo(t, { opacity: 0, y: 40 }, {
        opacity: 1, y: 0, duration: 1, ease: 'power3.out',
        scrollTrigger: { trigger: t, start: 'top 90%', toggleActions: 'play none none none' },
        delay: index * 0.15,
      });
    });

    // BG text parallax
    gsap.to('.ed-cta-bg-text', {
      y: -100, ease: 'none',
      scrollTrigger: { trigger: ref.current, start: 'top bottom', end: 'bottom top', scrub: true },
    });
  }, { scope: ref });

  // Marquee speed on fast scroll
  useEffect(() => {
    const handler = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > 50 && marqueeRef.current) {
        marqueeRef.current.style.animationDuration = '15s';
        const timer = setTimeout(() => {
          if (marqueeRef.current) marqueeRef.current.style.animationDuration = '30s';
        }, 500);
        return () => clearTimeout(timer);
      }
    };
    document.addEventListener('wheel', handler);
    return () => document.removeEventListener('wheel', handler);
  }, []);

  // Magnetic button effect
  const handleMagnetic = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    gsap.to(e.currentTarget, { x: x * 0.2, y: y * 0.2, duration: 0.4, ease: 'power3.out' });
  }, []);

  const handleMagneticLeave = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    gsap.to(e.currentTarget, { x: 0, y: 0, duration: 0.6, ease: 'elastic.out(1, 0.5)' });
  }, []);

  const renderMarqueeSet = () => (
    <>
      {marqueeItems.map((item, i) => (
        <span key={i} className="ed-marquee-item">
          {item.prefix ? (
            <>REAL-TIME <span className="blue">WIN PROBABILITY</span></>
          ) : (
            <><span className={item.cls}>{item.text}</span>{item.suffix}</>
          )}
        </span>
      ))}
    </>
  );

  return (
    <section ref={ref} className="ed-cta" id="cta">
      <div className="ed-cta-bg-text">GG</div>

      <div className="ed-cta-title-wrap">
        <span className="ed-cta-title-line"><SplitChars text="READY TO" /></span>
        <span className="ed-cta-title-line"><SplitChars text="PLAY LIKE A PRO?" /></span>
      </div>

      <div className="ed-cta-features-grid">
        {[
          { icon: '↑', label: 'UPLOAD', desc: 'Drop your .SC2Replay file' },
          { icon: '↔', label: 'COMPARE', desc: 'Match against 500K+ pro data points' },
          { icon: '✓', label: 'IMPROVE', desc: 'Get actionable insights' },
        ].map(f => (
          <div key={f.label} className="ed-cta-feature">
            <div className="ed-cta-feature-icon">{f.icon}</div>
            <div className="ed-cta-feature-label">{f.label}</div>
            <div className="ed-cta-feature-desc">{f.desc}</div>
          </div>
        ))}
      </div>

      <div className="ed-cta-button-wrap">
        <button
          className="ed-cta-button"
          onClick={onRegister}
          onMouseMove={handleMagnetic}
          onMouseLeave={handleMagneticLeave}
        >
          START ANALYZING FREE →
        </button>
        <div className="ed-cta-subtext" style={{ textAlign: 'center' }}>
          No information required • 3 uploads/month
        </div>
      </div>

      <div className="ed-marquee-wrap">
        <div ref={marqueeRef} className="ed-marquee-track">
          {renderMarqueeSet()}
          {renderMarqueeSet()}
        </div>
      </div>

      <div className="ed-testimonials">
        {capabilities.map(c => (
          <div key={c.label} className="ed-capability">
            <div className="ed-capability-label">{c.label}</div>
            <p className="ed-capability-text">{c.text}</p>
          </div>
        ))}
      </div>

      <div className="ed-footer-top">
        <div className="ed-footer-logo">SC2<span>ANALYZER</span></div>
        <div className="ed-footer-social">
          <a href="#">Discord</a>
          <a href="#">Twitter</a>
          <a href="#">Reddit</a>
          <a href="#">GitHub</a>
        </div>
      </div>

      <footer className="ed-footer">
        <p>SC2 Replay Analyzer — Built for competitive StarCraft II players.</p>
      </footer>
    </section>
  );
}

// ============================================
// MAIN LANDING PAGE
// ============================================
export default function LandingPage({ onLogin, onRegister }: LandingPageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollProgressRef = useRef<HTMLDivElement>(null);

  // Initialize Lenis smooth scroll
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
    });

    lenis.on('scroll', ScrollTrigger.update);

    gsap.ticker.add((time) => {
      lenis.raf(time * 1000);
    });
    gsap.ticker.lagSmoothing(0);

    return () => {
      lenis.destroy();
      gsap.ticker.remove(lenis.raf);
      ScrollTrigger.getAll().forEach(st => st.kill());
    };
  }, []);

  // Scroll progress line
  useGSAP(() => {
    if (!scrollProgressRef.current) return;
    gsap.to(scrollProgressRef.current, {
      scaleX: 1, ease: 'none',
      scrollTrigger: { trigger: document.body, start: 'top top', end: 'bottom bottom', scrub: true },
    });
  });

  // Keyboard accessibility
  useEffect(() => {
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Tab') document.body.classList.add('user-is-tabbing');
    };
    const mouseHandler = () => document.body.classList.remove('user-is-tabbing');
    document.addEventListener('keydown', keyHandler);
    document.addEventListener('mousedown', mouseHandler);
    return () => {
      document.removeEventListener('keydown', keyHandler);
      document.removeEventListener('mousedown', mouseHandler);
    };
  }, []);

  return (
    <div ref={containerRef} className="ed-landing" style={{ background: 'var(--ed-black)' }}>
      {/* Noise overlay */}
      <div className="ed-noise-overlay" />

      {/* Scroll progress */}
      <div ref={scrollProgressRef} className="ed-scroll-progress" />

      {/* Nav */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, width: '100%', zIndex: 1000,
        padding: '1.5rem clamp(1.5rem, 4vw, 5rem)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        mixBlendMode: 'difference',
      }}>
        <div className="ed-footer-logo" style={{ fontSize: '1.5rem' }}>SC2<span>ANALYZER</span></div>
        <div style={{ display: 'flex', gap: '2.5rem', alignItems: 'center' }}>
          <button
            onClick={onLogin}
            style={{
              fontFamily: 'var(--font-body)', fontSize: '0.8rem', fontWeight: 500,
              letterSpacing: '0.1em', textTransform: 'uppercase' as const,
              color: 'var(--ed-white)', background: 'none', border: 'none', cursor: 'pointer',
            }}
          >
            Sign In
          </button>
          <button
            onClick={onRegister}
            style={{
              fontFamily: 'var(--font-display)', fontSize: '1rem',
              letterSpacing: '0.05em', color: 'var(--ed-white)',
              padding: '0.5rem 1.5rem', border: '1px solid var(--ed-white)',
              background: 'transparent', cursor: 'pointer',
              transition: 'background 0.3s ease, color 0.3s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--ed-white)'; e.currentTarget.style.color = 'var(--ed-black)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ed-white)'; }}
          >
            Start Free
          </button>
        </div>
      </nav>

      <HeroSection onRegister={onRegister} />
      <EditorialDivider text="Feature Analysis" />
      <FeaturesSection />
      <EditorialDivider text="Timeline Deep Dive" />
      <TimelineSection />
      <ProcessSection />
      <EditorialDivider text="Strategic Insights" />
      <DecisionsSection />
      <ShowcaseSection />
      <EditorialDivider text="Race Analysis" />
      <StatsRibbon />
      <RaceSection />
      <CTASection onRegister={onRegister} />
    </div>
  );
}

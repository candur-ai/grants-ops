<script>
  const focusAreas = [
    {
      title: 'Education',
      text: 'Regardless of local educational opportunity, every student should be able to work with a one-on-one AI tutor at home. One-on-one tutoring has repeatedly shown some of the strongest education outcomes; making that support available to every student can supplement or, where needed, replace parts of the current model.',
    },
    {
      title: 'Career Paths',
      text: 'Traditional career paths are no longer a reliable route to promising, satisfying work. Too many college graduates are debt-ridden and underemployed. With AI as a catalyst, we can build a YC for Main Street: encouraging and funding young people to start businesses as an alternative or supplement to college.',
    },
    {
      title: 'Small Business',
      text: 'Main Street businesses may gain more than anyone from AI: better efficiency, stronger customer operations, and help filling labor gaps. We want to build a practical consultancy devoted solely to helping these businesses adopt AI in ways that improve their day-to-day work.',
    },
    {
      title: 'Health Care',
      text: 'Health care has centralized dramatically over the last 25 years. Independent practitioners have nearly disappeared into large systems, and that consolidation has hurt cost, access, and innovation. AI health care software can help independent practitioners return to community-based settings with tailored care and cost-effective business models.',
    },
    {
      title: 'Non-profits and Community Orgs',
      text: 'Local organizations already carry the work of community resilience. AI can help them find funding, communicate outcomes, reduce administrative drag, and turn limited staff capacity into durable operating systems.',
    },
    {
      title: 'Philosopher in Residence & Young Leaders Think Tank',
      text: 'In the age of AI, understanding what it means to be human matters more than ever. We want to devote consistent time and resources to studying and publishing on this question, especially with Gen Z and Gen Alpha wrestling with the contours, limits, and possibilities of a balanced life.',
    },
    {
      title: 'Practical AI by Profession',
      text: 'A video series for real workers and real operators: practical AI examples by profession, grounded in what people actually need to do on Monday morning.',
    },
  ];

  const pillars = [
    {
      number: '№ 01',
      kicker: 'Grant operations',
      title: 'Fund the Main Street AI agenda.',
      text: 'Discover public funding, evaluate fit, track deadlines, draft narratives, and keep eligibility gates honest for education, small business, health care, and community programs.',
      href: '#/grants',
    },
    {
      number: '№ 02',
      kicker: 'Search provider',
      title: 'Build from evidence, not vibes.',
      text: 'Candur Search gathers context across sources, carries a local lens, and saves evidence that can shape grants, program strategy, and agent debate.',
      href: '#/search-provider',
    },
    {
      number: '№ 03',
      kicker: 'Agent debates',
      title: 'Let competing futures argue first.',
      text: 'Create two personas, attach search context, and test ideas like AI tutors, Main Street entrepreneurship, or independent-practice health care before committing resources.',
      href: '#/debate',
    },
  ];
</script>

<section class="home-hero">
  <div class="wrap">
    <div class="dateline">
      <span>FROM: <b>Candur</b></span>
      <span>TO: <b>Main Street operators</b></span>
      <span>FILED: <b>2026</b></span>
      <span class="stamp">DRAFT · v.01</span>
    </div>

    <div class="hero-grid">
      <div>
        <p class="kicker">§ 01 / Position</p>
        <h1>Bringing AI to <span class="hl">Main Street.</span></h1>
      </div>
      <p class="lede">
        Candur exists to help students, workers, small businesses, health care practitioners, nonprofits, and
        community organizations use AI as practical infrastructure, not distant spectacle.
      </p>
    </div>

    <div class="actions">
      <a class="btn btn-primary" href="#/grants">Open Grant Ops →</a>
      <a class="btn btn-secondary" href="#/search-provider">Try search ↗</a>
    </div>
  </div>
</section>

<section class="thesis-section">
  <div class="wrap section-head">
    <p>§ 02 / Thesis</p>
    <h2>AI should restore local agency, not just centralize more power.</h2>
    <div>
      We are building the operating layer for Main Street AI: source-grounded search, grant operations, application drafting,
      and structured agent debate so local organizations can move from idea to funded action.
    </div>
  </div>
</section>

<section class="focus-section">
  <div class="wrap focus-head">
    <p>§ 03 / Main Street Agenda</p>
    <h2>Where we are putting the work.</h2>
  </div>
  <div class="wrap focus-grid">
    {#each focusAreas as area}
      <article class="focus-card">
        <h3>{area.title}</h3>
        <p>{area.text}</p>
      </article>
    {/each}
  </div>
</section>

<section class="programs">
  <div class="wrap program-grid">
    {#each pillars as pillar}
      <a class="program-card" href={pillar.href}>
        <div class="top">
          <span>{pillar.number}</span>
          <small>{pillar.kicker}</small>
        </div>
        <h3>{pillar.title}</h3>
        <p>{pillar.text}</p>
        <strong>Enter page <span>→</span></strong>
      </a>
    {/each}
  </div>
</section>

<section class="quote-section">
  <blockquote>
    <span>&gt;</span> The point is not AI for its own sake. The point is capability returning to the places people actually live and work.<i></i>
  </blockquote>
  <cite>Candur operating memo</cite>
</section>

<style>
  .wrap {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 24px;
  }

  .home-hero {
    padding: 80px 0;
    border-bottom: 1px solid var(--rule);
  }

  .dateline {
    display: flex;
    gap: 18px;
    flex-wrap: wrap;
    align-items: center;
    margin-bottom: 36px;
    font-family: var(--type);
    font-size: 13px;
    color: var(--ink-3);
    font-weight: 700;
  }

  .dateline b {
    color: var(--ink);
    font-family: var(--type);
  }

  .hero-grid,
  .section-head {
    display: grid;
    grid-template-columns: 140px minmax(0, 1fr) minmax(280px, 0.8fr);
    gap: 24px;
    align-items: baseline;
  }

  .hero-grid > div:first-child {
    display: contents;
  }

  .kicker,
  .section-head > p {
    font-family: var(--type);
    font-size: 12px;
    color: var(--sage);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-weight: 700;
    margin: 0;
  }

  h1 {
    font-size: clamp(48px, 7.5vw, 108px);
    line-height: 0.98;
    letter-spacing: 0;
    font-weight: 500;
    max-width: 12ch;
    margin: 0;
  }

  .lede {
    font-size: 20px;
    line-height: 1.5;
    color: var(--ink-2);
    margin: 0;
    max-width: 42ch;
  }

  .actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin-top: 48px;
    margin-left: calc(140px + 24px);
  }

  .thesis-section,
  .focus-section,
  .programs {
    padding: 80px 0;
    border-bottom: 1px solid var(--rule);
  }

  .section-head h2 {
    font-size: 36px;
    line-height: 1.05;
    letter-spacing: 0;
    font-weight: 500;
    max-width: 18ch;
    margin: 0;
  }

  .section-head div {
    color: var(--ink-2);
    max-width: 42ch;
    font-size: 15px;
  }

  .focus-head {
    display: grid;
    grid-template-columns: 140px minmax(0, 1fr);
    gap: 24px;
    align-items: baseline;
    margin-bottom: 28px;
  }

  .focus-head p {
    font-family: var(--type);
    font-size: 12px;
    color: var(--sage);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-weight: 700;
    margin: 0;
  }

  .focus-head h2 {
    font-size: 36px;
    line-height: 1.05;
    letter-spacing: 0;
    font-weight: 500;
    margin: 0;
  }

  .focus-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
  }

  .focus-card {
    border: 1px solid var(--rule);
    background: var(--card);
    border-radius: var(--r-5);
    padding: 24px;
  }

  .focus-card h3 {
    font-size: 22px;
    line-height: 1.15;
    letter-spacing: 0;
    margin: 0 0 12px;
    font-weight: 500;
  }

  .focus-card p {
    margin: 0;
    color: var(--ink-2);
    font-size: 14px;
    line-height: 1.6;
  }

  .program-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 18px;
  }

  .program-card {
    background: var(--card);
    border: 1px solid var(--rule);
    border-radius: var(--r-5);
    min-height: 340px;
    padding: 28px;
    display: flex;
    flex-direction: column;
    gap: 18px;
    color: var(--ink);
    transition: border-color var(--t-base), transform var(--t-base);
  }

  .program-card:hover {
    border-color: var(--ink);
    transform: translateY(-2px);
    color: var(--ink);
  }

  .program-card .top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
  }

  .program-card span,
  .program-card small {
    font-family: var(--type);
    color: var(--ink-3);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .program-card small {
    font-size: 11px;
    text-align: right;
  }

  .program-card h3 {
    font-size: 26px;
    line-height: 1.1;
    letter-spacing: 0;
    font-weight: 500;
    margin: 0;
  }

  .program-card p {
    font-size: 14px;
    line-height: 1.55;
    margin: 0;
    color: var(--ink-2);
    flex: 1;
  }

  .program-card strong {
    font-family: var(--type);
    font-size: 11px;
    color: var(--ink);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .program-card:hover strong {
    color: var(--sage);
  }

  .quote-section {
    padding: 96px 24px;
    text-align: center;
    background: var(--paper-2);
  }

  blockquote {
    font-family: var(--type);
    font-size: clamp(28px, 3.6vw, 42px);
    line-height: 1.4;
    margin: 0 auto;
    max-width: 34ch;
    color: var(--ink);
  }

  blockquote span {
    color: var(--sage);
    font-weight: 700;
  }

  blockquote i {
    display: inline-block;
    width: 0.6em;
    height: 1em;
    background: var(--sage);
    vertical-align: -0.12em;
    margin-left: 4px;
    animation: typeblink 1s steps(1) infinite;
  }

  cite {
    display: block;
    margin-top: 28px;
    font-style: normal;
    font-family: var(--type);
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--ink-3);
    font-weight: 700;
  }

  @media (max-width: 900px) {
    .hero-grid,
    .section-head,
    .focus-head,
    .focus-grid,
    .program-grid {
      grid-template-columns: 1fr;
    }

    .hero-grid > div:first-child {
      display: block;
    }

    .actions {
      margin-left: 0;
    }
  }
</style>

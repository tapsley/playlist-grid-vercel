import Image from "next/image";
import Link from "next/link";
import styles from "./page.module.css";

type ProjectCard = {
  href: string;
  title: string;
  description: string;
  imageSrc: string;
  imageAlt: string;
};

const projectCards: ProjectCard[] = [
  {
    href: "/resume",
    title: "Resume",
    description: "A concise look at my background, projects, and experience. \n\nDownload your own copy before you leave!",
    imageSrc: "/resumePage.png",
    imageAlt: "Resume page preview",
  },
  {
    href: "/playlist",
    title: "Playlist Grid feat. Spotify",
    description:
      "Any Spotify playlist presented as a beautiful grid of album art. \n\nThis is what I use to make my yearly music wrap-up post on Instagram.",
    imageSrc: "/playlistGrid.png",
    imageAlt: "Playlist Grid page preview",
  },
  {
    href: "/daily-notes",
    title: "Daily Notes",
    description:
      "A proof of concept for a daily notes app. \n\nFrontend: React + Typescript. \nBackend: Next.js API routes + Prisma + SQLite. Authentication with NextAuth.",
    imageSrc: "/dailyNotes.png",
    imageAlt: "Daily Notes page preview",
  },
  {
    href: "/roku",
    title: "Roku Player",
    description:
      "An in-browser Roku player to experience my custom apps, including my latest one: Nintendo Clips. \n\nRoku apps built with Brightscript and SceneGraph.",
    imageSrc: "/rokuPlayer.png",
    imageAlt: "Roku Player page preview",
  },
  {
    href: "/videoManager",
    title: "Video Manager",
    description:
      "A manager for the video clips used in the Nintendo Clips Roku app. \n\nFrontend: Next.js + React + TypeScript.\nBackend: API routes + Prisma + PostgreSQL + GCS.",
    imageSrc: "/videoManager.png",
    imageAlt: "Video Manager page preview",
  },
];

export default function SplashPage() {
  return (
    <main className={styles.page}>
      <section className={styles.container}>
        <header className={styles.header}>
          <h1 className={styles.title}>Hello, I&apos;m Tyler Apsley</h1>
          <p className={styles.subtitle}>
            Welcome to my little corner of the internet. Explore some of my projects
            below.
          </p>
        </header>

        <div className={styles.grid}>
          {projectCards.map((card) => (
            <Link key={card.href} href={card.href} className={styles.card}>
              <div className={styles.previewFrame}>
                <Image
                  src={card.imageSrc}
                  alt={card.imageAlt}
                  fill
                  sizes="(max-width: 900px) 100vw, 33vw"
                  className={styles.previewImage}
                />
              </div>
              <div className={styles.cardBody}>
                <h2 className={styles.cardTitle}>{card.title}</h2>
                <p className={styles.cardDescription}>{card.description}</p>
              </div>
            </Link>
          ))}
        </div>

        <footer className={styles.footer}>
          <small>Built with care. Open to opportunities.</small>
        </footer>
      </section>
    </main>
  );
}

"use client";

import Script from "next/script";

declare global {
  interface Window {
    __rokuBrsInit?: () => void;
    toggleDiv?: (divId: string) => void;
  }
}

function handleToggle() {
  window.toggleDiv?.("details");
}

export default function RokuPage() {
  const fileButtonClass =
    "absolute left-[342px] top-[572px] z-[30] inline-block cursor-pointer rounded-[6px] border-0 border-[#a511c0] bg-[#662d91] px-6 py-[10px] text-[15px] font-bold text-white no-underline shadow-[inset_0px_1px_0px_0px_#c123de] [text-shadow:0px_1px_0px_#9b14b3] hover:bg-[#3a1241] ";
  const iconButtonClass = "cursor-pointer border-none bg-transparent p-0";
  const modalDialogClass = "rounded-[7px] border border-[#662d91] text-[16px]";
  const modalInputClass =
    "my-5 box-border w-full rounded border border-[#ccc] p-[5px] text-[16px] outline-none focus:border-[#662d91]";
  const modalButtonClass =
    "w-[100px] cursor-pointer border-0 bg-[#662d91] py-[10px] text-[16px] text-white outline-none";

  return (
    <main className="min-h-screen bg-[#662d91] pb-4 text-black">
      <link
        href="https://fonts.googleapis.com/css?family=Maven+Pro|Muli|Istok+Web"
        rel="stylesheet"
        type="text/css"
      />
<h1 className="text-white p-4">I wanted a way to show my Roku projects on my website and I found this web player made by <a href="https://lvcabral.com/brs/?pkg=pop-roku" target="_blank" rel="noreferrer" className="underline">Marcelo Lv Cabral</a>. It's amazing! This UI is lifted from <a href="https://github.com/lvcabral/brs-engine" target="_blank" rel="noreferrer" className="underline">his work</a>, so thank you to him! You can play the Roku apps that I have built here! Press ESC to exit the app, and be aware that functionality won't match to what you would see on a real Roku.</h1>
      <div
        id="container"
        className="mx-auto min-h-[80%] min-w-[1200px] max-w-[1260px] rounded-[5px] bg-[whitesmoke] px-[30px] pb-[5px] pt-[10px] shadow-[3px_3px_5px_#444]"
      >


        <div style={{ position: "relative", left: 0, top: 0 }}>
          <img
            className="absolute z-[1] left-[25px] top-[15px] scale-[1.05]"
            src="/roku-engine/images/brightscript-tv.png"
            width={1252}
            height={650}
            alt="tv background"
          />
          <img
            id="loading"
            className="invisible absolute left-[45px] top-[29px] z-[60] opacity-90"
            src="/roku-engine/images/loading.gif"
            width={854}
            height={480}
            alt="loading..."
          />
          <div id="stats" className="invisible absolute left-[45px] top-[29px] z-[60] opacity-50"></div>
          <canvas
            id="display"
            className="relative left-[45px] top-[29px] z-[20] bg-black opacity-0"
            width={854}
            height={480}
          ></canvas>
          <video id="player" className="fixed z-[30] opacity-0" crossOrigin="anonymous"></video>
          <img id="app01" className="absolute left-[398px] top-[135px] z-[30] h-[101px] w-[134px] cursor-pointer" alt="app 1" />
          <img id="app02" className="absolute left-[541px] top-[135px] z-[30] h-[101px] w-[134px] cursor-pointer" alt="app 2" />
          <span id="appInfo" className="absolute left-[320px] top-[560px] z-[30] text-white"></span>
          <input type="file" id="file" accept=".brs,.zip,.bpk" style={{ display: "none" }} />
          <input type="button" id="fileButton" className={fileButtonClass} value="Open a ZIP, BPK or BRS file..." />
          <br />
          <br />
          <br />
          <br />
          <br />
          <br />
          <br />

          <div id="expand-new" style={{ textAlign: "center" }}>
            <button className={iconButtonClass} title="Expand Project Information" onClick={handleToggle}>
              <img
                src="/roku-engine/images/expand-new.png"
                alt="Expand Project Information"
                width={298}
                height={100}
              />
            </button>
          </div>
          <div id="expand" style={{ textAlign: "center", display: "none" }}>
            <button className={iconButtonClass} title="Expand Project Information" onClick={handleToggle}>
              <img
                src="/roku-engine/images/expand.png"
                alt="Expand Project Information"
                width={298}
                height={100}
              />
            </button>
          </div>
          <div id="collapse" style={{ textAlign: "center", display: "none" }}>
            <button className={iconButtonClass} title="Hide Project Information" onClick={handleToggle}>
              <img
                src="/roku-engine/images/collapse.png"
                alt="Hide Project Information"
                width={298}
                height={100}
              />
            </button>
          </div>

          <dialog id="passwordDialog" className={modalDialogClass}>
            <p className="my-[10px]">Please enter the password to decrypt the package:</p>
            <form method="dialog" name="passwordForm">
              <input type="text" name="password" className={modalInputClass} />
              <button value="ok" className={modalButtonClass}>
                OK
              </button>
              <button
                value="cancel"
                className="ml-[10px] w-[100px] cursor-pointer border border-[#662d91] bg-white py-[10px] text-[16px] text-[#662d91]"
              >
                Cancel
              </button>
            </form>
          </dialog>
        </div>

        <div id="details" style={{ display: "none" }}>
          <hr className="border-0 border-b border-[#aaa]" />
          <img
            src="/roku-engine/images/icon.png"
            alt="brs-engine icon"
            width={48}
            height={48}
            style={{ float: "right", marginTop: "1px" }}
          />
          <h2 className="text-[1.5em] text-[#3e5763]">
            BrightScript Simulation Engine :: v<span id="libVersion"></span>
            <hr className="border-0 border-b border-[#aaa]" />
          </h2>
          <h3 className="text-[#3e5763]">How to Use the BrightScript TV</h3>
          <p className="text-justify">
            &ndash;&nbsp;Click on any app icon in the BrightScript TV menu screen or load your own app or code using
            the purple button above.
          </p>
          <p className="text-justify">
            &ndash;&nbsp;When an app is running, you can make it <b>full screen</b> by double-clicking on the
            display.
          </p>
          <p className="text-justify">
            &ndash;&nbsp;Use your keyboard to navigate on the games and apps, the image you see on the right side,
            shows what keys that are mapped to the Roku remote control buttons.
          </p>

          <h3 className="text-[#3e5763]">Notes for BrightScript Developers</h3>
          <p className="text-justify">
            You can see the debug messages from <code className="bg-[#f3e2fa] text-[16px]">print</code> statements in your code using the <em>browser
            console</em>, just right click anywhere in the page and select <em>Inspect (Ctrl+Shift+i)</em>.
            Exceptions from the engine library will be shown there too.
          </p>
          <p className="text-justify">
            If you added a break point (<b>stop</b>) in your code, you can also debug using the <em>browser
            console</em>, just send the commands using: <code className="bg-[#f3e2fa] text-[16px]">brs.debug(&quot;help&quot;)</code>
          </p>
          <p className="text-justify">
            The Roku registry data is stored on the browser Local Storage and you can inspect it using the Developer
            Tools.
          </p>
          <p className="text-justify">
            For a better debugging experience, is recommended to use the engine desktop application integrated with
            <b> Visual Studio Code</b>, you will find more details in the links below.
          </p>

          <h3 className="text-[#3e5763]">Documentation and Downloads</h3>
          <p className="text-justify">
            To learn more about the project visit the repository at:{" "}
            <a className="text-[#3e5763]" href="https://github.com/lvcabral/brs-engine/#readme" target="_blank" rel="noreferrer">
              https://github.com/lvcabral/brs-engine/
            </a>
          </p>
          <p className="text-justify">
            To download the <b>Desktop Applications</b> for <b>Windows, macOS and Linux</b> go to the{" "}
            <a className="text-[#3e5763]" href="https://github.com/lvcabral/brs-desktop/releases" target="_blank" rel="noreferrer">
              releases page
            </a>
            .
          </p>
          <p className="text-justify">
            You can download the source code of this project in either{" "}
            <a className="text-[#3e5763]" href="https://github.com/lvcabral/brs-engine/zipball/master" target="_blank" rel="noreferrer">
              zip
            </a>{" "}
            or{" "}
            <a className="text-[#3e5763]" href="https://github.com/lvcabral/brs-engine/tarball/master" target="_blank" rel="noreferrer">
              tar
            </a>{" "}
            formats.
          </p>
          <p className="text-justify">You can also clone the project with Git by running:</p>
          <pre className="rounded-[3px] bg-white p-[15px] text-black shadow-[0px_0px_10px_#ccc]">$ git clone https://github.com/lvcabral/brs-engine</pre>

          <div className="pt-[30px] text-center">
            <hr className="border-0 border-b border-[#aaa]" />
            Copyright © 2019-2026 by{" "}
            <a className="text-[#3e5763]" href="https://lvcabral.com" target="_blank" rel="noreferrer">
              Marcelo Lv Cabral
            </a>
          </div>
        </div>
      </div>

      <Script
        src="https://cdn.jsdelivr.net/npm/browserfs@1.4.3/dist/browserfs.min.js"
        integrity="sha384-L07lTedW5DiD4A4BIBVv5x29NyDiU/Kt9CglteSqOggJlnvE9QPH3fTv4j+yqGoI"
        crossOrigin="anonymous"
        strategy="afterInteractive"
      />
      <Script src="/roku-engine/lib/brs.api.js" strategy="afterInteractive" />
      <Script
        src="/roku-engine/index.js"
        strategy="afterInteractive"
        onLoad={() => {
          window.__rokuBrsInit?.();
        }}
      />
    </main>
  );
}

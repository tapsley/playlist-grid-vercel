export const metadata = {
  title: 'Tyler Apsley — Resume',
};

export default function ResumePage() {
  const pdfPath = '/TylerApsley_2025Resume.pdf';

  return (
    <div className="min-h-screen bg-white text-gray-900 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-semibold">Tyler Apsley — Resume</h1>
          <div className="flex gap-2">
            <a
              href={pdfPath}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              Open PDF in new tab
            </a>
            <a
              href={pdfPath}
              download
              className="px-4 py-2 bg-gray-200 text-gray-900 rounded-md hover:bg-gray-300"
            >
              Download
            </a>
          </div>
        </div>

        <div className="h-[80vh] border border-gray-200 shadow-sm">
          <iframe
            src={pdfPath}
            title="Tyler Apsley Resume"
            className="w-full h-full"
          />
        </div>

        <div className="mt-6 text-sm text-gray-600">
          <p>
            If your browser doesn't display the PDF, you can download it using the "Download" button.
          </p>
        </div>
      </div>
    </div>
  );
}

import React from 'react';

type TimetableViewerProps = {
    fileUrl: string | null;
    fileName: string | null;
    fileType: string | null;
};

const TimetableViewer: React.FC<TimetableViewerProps> = ({ fileUrl, fileName, fileType }) => {
    if (!fileUrl) {
        return (
            <div className="border rounded-lg p-8 text-center">
                <p className="text-text-secondary">No timetable uploaded yet.</p>
            </div>
        );
    }

    const isPDF = fileType === 'application/pdf';
    const isImage = fileType?.startsWith('image/');

    return (
        <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold">Current Timetable</h4>
                <a
                    href={fileUrl}
                    download={fileName || 'timetable'}
                    className="text-xs text-blue-600 hover:underline"
                >
                    Download
                </a>
            </div>

            <div className="bg-gray-50 rounded p-2">
                {isPDF ? (
                    <iframe
                        src={fileUrl}
                        className="w-full h-[600px] border rounded"
                        title="Timetable PDF"
                    />
                ) : isImage ? (
                    <img
                        src={fileUrl}
                        alt="Timetable"
                        className="w-full h-auto rounded"
                    />
                ) : (
                    <div className="p-4 text-center text-text-secondary">
                        <p>Preview not available for this file type</p>
                        <a
                            href={fileUrl}
                            download={fileName || 'timetable'}
                            className="text-blue-600 hover:underline mt-2 inline-block"
                        >
                            Download to view
                        </a>
                    </div>
                )}
            </div>

            {fileName && (
                <div className="mt-2 text-xs text-text-secondary">
                    File: {fileName}
                </div>
            )}
        </div>
    );
};

export default TimetableViewer;

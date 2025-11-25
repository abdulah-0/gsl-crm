import React, { useState } from 'react';

type ApplicationEntry = {
    id: string;
    courseApplied: string;
    applicationDate: string;
    comment: string;
    createdAt: string;
};

type UniversityWithApplications = {
    universityId: string;
    universityName: string;
    applications: ApplicationEntry[];
};

type UniversityApplicationHistoryProps = {
    data: UniversityWithApplications[];
};

const UniversityApplicationHistory: React.FC<UniversityApplicationHistoryProps> = ({
    data,
}) => {
    const [expandedUniversities, setExpandedUniversities] = useState<Set<string>>(
        new Set()
    );

    const toggleUniversity = (universityId: string) => {
        setExpandedUniversities((prev) => {
            const next = new Set(prev);
            if (next.has(universityId)) {
                next.delete(universityId);
            } else {
                next.add(universityId);
            }
            return next;
        });
    };

    if (data.length === 0) {
        return (
            <div className="text-sm text-text-secondary text-center py-4">
                No application history yet
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {data.map((uni) => {
                const isExpanded = expandedUniversities.has(uni.universityId);
                return (
                    <div key={uni.universityId} className="border rounded-lg">
                        <button
                            onClick={() => toggleUniversity(uni.universityId)}
                            className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition"
                        >
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold">{uni.universityName}</span>
                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                                    {uni.applications.length} {uni.applications.length === 1 ? 'application' : 'applications'}
                                </span>
                            </div>
                            <span className="text-text-secondary">
                                {isExpanded ? '▼' : '▶'}
                            </span>
                        </button>

                        {isExpanded && (
                            <div className="px-4 pb-3 space-y-3 border-t">
                                {uni.applications.map((app) => (
                                    <div
                                        key={app.id}
                                        className="pt-3 text-sm border-l-2 border-blue-200 pl-3"
                                    >
                                        <div className="font-medium text-gray-900">
                                            Course Applied: {app.courseApplied}
                                        </div>
                                        <div className="text-text-secondary mt-1">
                                            Date: {new Date(app.applicationDate).toLocaleDateString()}
                                        </div>
                                        {app.comment && (
                                            <div className="text-text-secondary mt-1">
                                                Comment: {app.comment}
                                            </div>
                                        )}
                                        <div className="text-xs text-text-secondary mt-2">
                                            Submitted: {new Date(app.createdAt).toLocaleString()}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default UniversityApplicationHistory;

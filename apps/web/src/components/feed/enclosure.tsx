import type { FeedEnclosure as IFeedEnclosure } from "../../../../server/src/schemas/feed";

interface EnclosureProps {
  enclosure: IFeedEnclosure;
  type?: 'audio' | 'video' | 'image' | 'document';
}

export function Enclosure({ enclosure, type }: EnclosureProps) {
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const getIcon = () => {
    const iconClass = "w-4 h-4 text-gray-600 dark:text-gray-400";
    
    if (type === 'audio' || enclosure.type?.startsWith('audio/')) {
      return (
        <svg className={iconClass} fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM15.657 6.343a1 1 0 011.414 0A9.972 9.972 0 0119 12a9.972 9.972 0 01-1.929 5.657 1 1 0 11-1.414-1.414A7.971 7.971 0 0017 12c0-1.594-.471-3.078-1.343-4.243a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      );
    }
    
    if (type === 'video' || enclosure.type?.startsWith('video/')) {
      return (
        <svg className={iconClass} fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm3 2h6v4H7V5zm8 8v2h1v-2h-1zm-2-2H7v4h6v-4z" clipRule="evenodd" />
        </svg>
      );
    }
    
    if (type === 'image' || enclosure.type?.startsWith('image/')) {
      return (
        <svg className={iconClass} fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
        </svg>
      );
    }
    
    return (
      <svg className={iconClass} fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
      </svg>
    );
  };

  const renderMedia = () => {
    if (type === 'audio' || enclosure.type?.startsWith('audio/')) {
      return (
        <audio controls className="w-full">
          <source src={enclosure.url} type={enclosure.type || 'audio/mpeg'} />
          Your browser does not support the audio element.
        </audio>
      );
    }
    
    if (type === 'video' || enclosure.type?.startsWith('video/')) {
      return (
        <video controls className="w-full rounded">
          <source src={enclosure.url} type={enclosure.type || 'video/mp4'} />
          Your browser does not support the video element.
        </video>
      );
    }
    
    if (type === 'image' || enclosure.type?.startsWith('image/')) {
      return (
        <img
          src={enclosure.url}
          alt={enclosure.title || 'Enclosure image'}
          className="w-full rounded"
          loading="lazy"
        />
      );
    }
    
    return (
      <a
        href={enclosure.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
      >
        Download {enclosure.type || 'file'}
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </a>
    );
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-2">
        {getIcon()}
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {enclosure.title || type || 'Media'}
        </span>
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 ml-auto">
          {enclosure.length && (
            <span>{formatFileSize(enclosure.length)}</span>
          )}
          {enclosure.duration && (
            <span>{formatDuration(enclosure.duration)}</span>
          )}
        </div>
      </div>
      {renderMedia()}
    </div>
  );
}

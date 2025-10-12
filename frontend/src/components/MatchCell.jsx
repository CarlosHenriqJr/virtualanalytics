import React from 'react';

const MatchCell = ({ match, showHT, filterColor, onClick }) => {
  const { timeCasa, timeFora, placarFT, placarHT } = match;
  
  const baseClasses = filterColor 
    ? filterColor 
    : 'bg-gray-900 hover:bg-gray-800';
  
  return (
    <button
      onClick={onClick}
      className={`w-full h-full p-0.5 text-[9px] leading-tight transition-colors cursor-pointer flex flex-col items-center justify-center ${baseClasses}`}
      title={`${timeCasa} x ${timeFora}`}
    >
      <div className="font-semibold text-white truncate w-full text-center px-0.5">
        {timeCasa.substring(0, 3)} x {timeFora.substring(0, 3)}
      </div>
      <div className="font-bold text-green-400 text-[10px]">
        {placarFT}
      </div>
      {showHT && (
        <div className="text-gray-400 text-[8px]">
          HT: {placarHT}
        </div>
      )}
    </button>
  );
};

export default MatchCell;
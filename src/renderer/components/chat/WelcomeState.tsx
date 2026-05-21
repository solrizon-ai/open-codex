import { Composer } from "./Composer";
import { SuggestionList } from "./SuggestionList";
import { memo } from "react";

export const WelcomeState = memo(function WelcomeState({
  projectName = "supercad",
}: {
  projectName?: string;
}) {
  return (
    <section className="flex min-w-0 flex-1 flex-col items-center justify-start px-4 pt-[14vh] sm:pt-[18vh]">
      <h1 className="mb-7 w-full max-w-[640px] text-center text-[clamp(18px,3.2vw,26px)] font-medium leading-tight tracking-tight text-zinc-900 dark:text-zinc-100">
        要在 <span className="font-semibold">{projectName}</span> 中构建什么?
      </h1>
      <div className="w-full max-w-[760px]">
        <Composer />
      </div>
      <SuggestionList />
    </section>
  );
});

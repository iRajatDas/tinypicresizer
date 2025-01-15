import React from "react";
import Wrapper from "@/components/wrapper";
import { GalleryVerticalEnd } from "lucide-react";

const SiteHeader = () => {
  return (
    <Wrapper
      as="header"
      className="flex items-center justify-between whitespace-nowrap border-b border-solid border-b-[#F4EFE6] py-5"
    >
      <div className="flex items-center gap-4 text-[#1C160C]">
        <div className="grid place-items-center size-10 bg-red-200">
          <GalleryVerticalEnd className="size-6" />
        </div>
        <h2 className="text-[#1C160C] text-lg font-bold leading-tight tracking-[-0.015em]">
          Image Toolbox
        </h2>
      </div>
      <div className="flex flex-1 justify-end gap-8">
        <div
          className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10"
          style={{
            backgroundImage:
              'url("https://cdn.usegalileo.ai/sdxl10/4ec79665-d426-4c5c-9bf8-31bf5a40700d.png")',
          }}
        />
      </div>
    </Wrapper>
  );
};

export default SiteHeader;

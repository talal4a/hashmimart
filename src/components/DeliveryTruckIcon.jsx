import { DotLottiePlayer } from "@dotlottie/react-player";
import "@dotlottie/react-player/dist/index.css";

const DeliveryTruckIcon = () => {
  return (
    <div className="w-12 h-12 flex items-center justify-center">
      <DotLottiePlayer
        src="https://lottie.host/804d0361-9f93-4e31-8f4b-3df95a5f70b1/Q2WoVTiHUy.lottie"
        autoplay
        loop
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
};

export default DeliveryTruckIcon;

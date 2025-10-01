import PulsatingLoader from '@/components/ui/pulsating-loader';

export default function RootLoading() {
  return (
    <div className="flex items-center justify-center h-screen">
      <PulsatingLoader />
    </div>
  );
}

import { useParams } from "react-router";

const ConfirmationPage = () => {
  const { pnr } = useParams<{ pnr: string }>();

  return (
    <div className="px-4 py-8">
      <h1 className="text-2xl font-bold">Confirmation</h1>
      <p className="mt-2 text-gray-500">PNR : {pnr ?? "—"}</p>
    </div>
  );
};

export default ConfirmationPage;

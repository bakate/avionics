import { useParams } from "react-router";

const SelectPage = () => {
  const { flightId } = useParams<{ flightId: string }>();

  return (
    <div className="px-4 py-8">
      <h1 className="text-2xl font-bold">Sélection de cabine</h1>
      <p className="mt-2 text-gray-500">Vol sélectionné : {flightId ?? "—"}</p>
    </div>
  );
};

export default SelectPage;

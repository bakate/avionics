import { effectTsResolver } from "@hookform/resolvers/effect-ts";
import {
  Calendar03Icon,
  Mail01Icon,
  UserCircleIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useSelector } from "@xstate/react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { bookingActor } from "../features/booking/machines/booking.actor";
import {
  encodePassengerInput,
  PassengerInput,
  type PassengerInputEncoded,
} from "../features/booking/schemas/passenger.schema";

const inputClass = (hasError: boolean) =>
  `h-12 w-full rounded-xl border px-4 text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${
    hasError
      ? "border-red-400 bg-red-50 text-red-900 placeholder:text-red-300"
      : "border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-blue-500"
  }`;

const FieldWrapper = ({
  children,
  error,
  label,
  icon: Icon,
}: {
  children: React.ReactNode;
  label: string;
  error?: string | undefined;
  icon: any;
}) => (
  <div className="space-y-2">
    <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
      <HugeiconsIcon icon={Icon} size={14} className="text-slate-400" />
      {label}
    </p>
    {children}
    {error && (
      <p className="text-xs font-medium text-red-500" role="alert">
        {error}
      </p>
    )}
  </div>
);

const PassengersPage = () => {
  const state = useSelector(bookingActor, (s) => s);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PassengerInputEncoded>({
    resolver: effectTsResolver(PassengerInput) as any,
    defaultValues: state.context.passengers[0]
      ? encodePassengerInput(state.context.passengers[0])
      : {
          firstName: "",
          lastName: "",
          email: "",
          gender: "OTHER" as any,
          dateOfBirth: "",
        },
  });

  const onSubmit = (data: unknown) => {
    // The resolver transforms the data to the decoded Type
    bookingActor.send({
      type: "SET_PASSENGERS",
      passengers: [data as PassengerInput],
    });
    void navigate("/payment");
  };

  if (!state.context.selectedOutbound) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-slate-500">Aucun vol sélectionné.</p>
        <button
          type="button"
          className="mt-4 font-bold text-blue-600 hover:underline"
          onClick={() => void navigate("/")}>
          Retourner à l'accueil
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">
          Informations passagers
        </h1>
        <p className="mt-2 text-slate-500">
          Veuillez saisir les détails du passager pour votre vol vers{" "}
          <span className="font-semibold text-slate-700">
            {state.context.selectedOutbound.flight.flightNumber}
          </span>
        </p>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <FieldWrapper
            label="Prénom"
            icon={UserCircleIcon}
            error={errors.firstName?.message}>
            <input
              {...register("firstName")}
              placeholder="Ex: Jean"
              className={inputClass(Boolean(errors.firstName))}
            />
          </FieldWrapper>

          <FieldWrapper
            label="Nom"
            icon={UserCircleIcon}
            error={errors.lastName?.message}>
            <input
              {...register("lastName")}
              placeholder="Ex: Dupont"
              className={inputClass(Boolean(errors.lastName))}
            />
          </FieldWrapper>
        </div>

        <FieldWrapper
          label="Email"
          icon={Mail01Icon}
          error={errors.email?.message}>
          <input
            {...register("email")}
            type="email"
            placeholder="jean.dupont@exemple.com"
            className={inputClass(Boolean(errors.email))}
          />
        </FieldWrapper>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <FieldWrapper
            label="Date de naissance"
            icon={Calendar03Icon}
            error={errors.dateOfBirth?.message}>
            <input
              {...register("dateOfBirth")}
              type="date"
              className={inputClass(Boolean(errors.dateOfBirth))}
            />
          </FieldWrapper>

          <FieldWrapper
            label="Genre"
            icon={UserCircleIcon}
            error={errors.gender?.message}>
            <select
              {...register("gender")}
              className={inputClass(Boolean(errors.gender))}>
              <option value="MALE">Homme</option>
              <option value="FEMALE">Femme</option>
              <option value="OTHER">Autre</option>
            </select>
          </FieldWrapper>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 pt-6">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="text-sm font-bold text-slate-500 hover:text-slate-700">
            Retour
          </button>
          <button
            type="submit"
            className="rounded-xl bg-blue-600 px-8 py-3 font-bold text-white transition-all hover:bg-blue-700 active:scale-95 disabled:opacity-50">
            Continuer vers le paiement
          </button>
        </div>
      </form>
    </div>
  );
};

export default PassengersPage;

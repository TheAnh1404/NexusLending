import { useLending } from '../contexts/LendingContext';

export const useOffers = () => {
  const { offers, loanOffers, createOffer, createLoanOffer, cancelOffer, acceptOffer, borrowLoan } = useLending();

  return {
    offers,
    loanOffers,
    listedOffers: offers.filter((offer) => offer.status === 'Active'),
    createOffer,
    createLoanOffer,
    cancelOffer,
    acceptOffer,
    borrowLoan,
  };
};

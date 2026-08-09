package sakura

import (
	"context"
	"os"
	"time"

	"github.com/sacloud/sacloud-sdk-go/api/iaas"
	"github.com/sacloud/sacloud-sdk-go/api/iaas/types"
)

type BillInfo struct {
	ID        string `json:"id"`
	Amount    int64  `json:"amount"`
	Date      string `json:"date"`
	Paid      bool   `json:"paid"`
	PayLimit  string `json:"payLimit"`
}

type BillDetailInfo struct {
	ID               string `json:"id"`
	Amount           int64  `json:"amount"`
	Description      string `json:"description"`
	ServiceClassPath string `json:"serviceClassPath"`
	Usage            int64  `json:"usage"`
	FormattedUsage   string `json:"formattedUsage"`
	Zone             string `json:"zone"`
}

type BillService struct {
	client *Client
}

func NewBillService(client *Client) *BillService {
	return &BillService{client: client}
}

func (s *BillService) ListByContract(ctx context.Context, accountID string) ([]BillInfo, error) {
	billOp := iaas.NewBillOp(s.client.Caller())
	result, err := billOp.ByContract(ctx, types.StringID(accountID))
	if err != nil {
		return nil, err
	}
	return convertBills(result.Bills), nil
}

// ListByContractYear returns bills for the given account narrowed down to the specified year.
func (s *BillService) ListByContractYear(ctx context.Context, accountID string, year int) ([]BillInfo, error) {
	billOp := iaas.NewBillOp(s.client.Caller())
	result, err := billOp.ByContractYear(ctx, types.StringID(accountID), year)
	if err != nil {
		return nil, err
	}
	return convertBills(result.Bills), nil
}

// ListByContractYearMonth returns bills for the given account narrowed down to the specified year and month.
func (s *BillService) ListByContractYearMonth(ctx context.Context, accountID string, year, month int) ([]BillInfo, error) {
	billOp := iaas.NewBillOp(s.client.Caller())
	result, err := billOp.ByContractYearMonth(ctx, types.StringID(accountID), year, month)
	if err != nil {
		return nil, err
	}
	return convertBills(result.Bills), nil
}

func convertBills(src []*iaas.Bill) []BillInfo {
	bills := make([]BillInfo, 0, len(src))
	for _, b := range src {
		bills = append(bills, BillInfo{
			ID:       b.ID.String(),
			Amount:   b.Amount,
			Date:     b.Date.Format("2006-01"),
			Paid:     b.Paid,
			PayLimit: b.PayLimit.Format(time.RFC3339),
		})
	}
	return bills
}

func (s *BillService) GetDetails(ctx context.Context, memberCode string, billID string) ([]BillDetailInfo, error) {
	billOp := iaas.NewBillOp(s.client.Caller())
	result, err := billOp.Details(ctx, memberCode, types.StringID(billID))
	if err != nil {
		return nil, err
	}

	details := make([]BillDetailInfo, 0, len(result.BillDetails))
	for _, d := range result.BillDetails {
		details = append(details, BillDetailInfo{
			ID:               d.ID.String(),
			Amount:           d.Amount,
			Description:      d.Description,
			ServiceClassPath: d.ServiceClassPath,
			Usage:            d.Usage,
			FormattedUsage:   d.FormattedUsage,
			Zone:             d.Zone,
		})
	}
	return details, nil
}

// DownloadDetailsCSV fetches the billing detail CSV and writes it to the specified path.
func (s *BillService) DownloadDetailsCSV(ctx context.Context, memberCode string, billID string, savePath string) error {
	billOp := iaas.NewBillOp(s.client.Caller())
	result, err := billOp.DetailsCSV(ctx, memberCode, types.StringID(billID))
	if err != nil {
		return err
	}
	return os.WriteFile(savePath, []byte(result.RawBody), 0o600)
}

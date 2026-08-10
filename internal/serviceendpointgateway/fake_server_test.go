package serviceendpointgateway_test

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync"
	"time"

	"github.com/go-faster/jx"
	v1 "github.com/sacloud/sacloud-sdk-go/api/service-endpoint-gateway/apis/v1"
)

// fakeServer は sakumock が service-endpoint-gateway 未対応のため自作した簡易テストサーバー。
// SDK(ogen生成)が実際に発行するHTTPリクエストのみをカバーする最小限のインメモリ実装。
type fakeServer struct {
	mu         sync.Mutex
	appliances map[string]*v1.ModelsApplianceAppliance
	nextID     int
}

func newFakeServer() *httptest.Server {
	f := &fakeServer{
		appliances: map[string]*v1.ModelsApplianceAppliance{},
		nextID:     100,
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /appliance", f.handleList)
	mux.HandleFunc("POST /appliance", f.handleCreate)
	mux.HandleFunc("GET /appliance/{id}", f.handleGet)
	mux.HandleFunc("PUT /appliance/{id}", f.handleUpdate)
	mux.HandleFunc("DELETE /appliance/{id}", f.handleDelete)
	mux.HandleFunc("PUT /appliance/{id}/config", f.handleApply)
	mux.HandleFunc("GET /appliance/{id}/interface/{interfaceID}", f.handleGetInterface)
	mux.HandleFunc("GET /appliance/{id}/power", f.handleGetPowerStatus)
	mux.HandleFunc("PUT /appliance/{id}/power", f.handlePowerOn)
	mux.HandleFunc("DELETE /appliance/{id}/power", f.handlePowerOff)
	mux.HandleFunc("PUT /appliance/{id}/reset", f.handleReset)

	return httptest.NewServer(mux)
}

// jsonMarshaler は ogen 生成型のインターフェース。これら生成型は *T にのみ MarshalJSON
// (jx.Encoder経由)を実装しており、値渡しだとreflectベースの標準エンコードにフォールバックして
// Opt/Nilラッパー型のゼロ値でエラーになるため、必ずポインタで渡す。
type jsonMarshaler interface {
	MarshalJSON() ([]byte, error)
}

func writeJSON(w http.ResponseWriter, status int, v jsonMarshaler) {
	body, err := v.MarshalJSON()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_, _ = w.Write(body)
}

func writeNotFound(w http.ResponseWriter) {
	writeJSON(w, http.StatusNotFound, &v1.ModelsCommonDefaultErrorResponseBody{})
}

func (f *fakeServer) handleList(w http.ResponseWriter, r *http.Request) {
	f.mu.Lock()
	defer f.mu.Unlock()

	appliances := make([]v1.ModelsApplianceAppliance, 0, len(f.appliances))
	for _, a := range f.appliances {
		appliances = append(appliances, *a)
	}
	writeJSON(w, http.StatusOK, &v1.ModelsApplianceApplianceListResponseBody{
		From:       0,
		Count:      int32(len(appliances)),
		Total:      int32(len(appliances)),
		Appliances: appliances,
		IsOk:       true,
	})
}

func (f *fakeServer) handleCreate(w http.ResponseWriter, r *http.Request) {
	var req v1.ModelsApplianceApplianceCreateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, &v1.ModelsCommonDefaultErrorResponseBody{})
		return
	}

	f.mu.Lock()
	defer f.mu.Unlock()

	f.nextID++
	id := fmt.Sprintf("%d", f.nextID)

	a := &v1.ModelsApplianceAppliance{
		ID:           id,
		Class:        v1.ModelsApplianceApplianceClassServiceendpointgateway,
		Plan:         req.Appliance.Plan,
		Availability: v1.ModelsApplianceApplianceAvailabilityAvailable,
		ServiceClass: v1.ModelsApplianceApplianceServiceClassCloudApplianceServiceendpointgateway1,
		Generation:   1,
		CreatedAt:    time.Now().UTC().Format(time.RFC3339),
		Icon:         jx.Raw("null"),
		Switch: v1.ModelsNetworkSwitch{
			ID:           req.Appliance.Remark.Switch.ID,
			Name:         "switch-" + req.Appliance.Remark.Switch.ID,
			Scope:        v1.ModelsNetworkSwitchScopeUser,
			Availability: v1.ModelsNetworkSwitchAvailabilityAvailable,
		},
	}
	a.Instance.Status.SetTo(v1.ModelsInstanceInstanceStatusDown)
	f.appliances[id] = a

	writeJSON(w, http.StatusAccepted, &v1.ModelsApplianceApplianceCreateResponseBody{
		Appliance: *a,
		IsOk:      true,
	})
}

func (f *fakeServer) handleGet(w http.ResponseWriter, r *http.Request) {
	f.mu.Lock()
	defer f.mu.Unlock()

	a, ok := f.appliances[r.PathValue("id")]
	if !ok {
		writeNotFound(w)
		return
	}
	writeJSON(w, http.StatusOK, &v1.ModelsApplianceApplianceGetResponseBody{Appliance: *a, IsOk: true})
}

func (f *fakeServer) handleUpdate(w http.ResponseWriter, r *http.Request) {
	var req v1.ModelsApplianceApplianceUpdateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, &v1.ModelsCommonDefaultErrorResponseBody{})
		return
	}

	f.mu.Lock()
	defer f.mu.Unlock()

	a, ok := f.appliances[r.PathValue("id")]
	if !ok {
		writeNotFound(w)
		return
	}
	a.Settings.SetTo(req.Appliance.Settings)
	a.SettingsHash.SetTo("hash-" + a.ID)

	writeJSON(w, http.StatusOK, &v1.ModelsApplianceApplianceGetResponseBody{Appliance: *a, IsOk: true})
}

func (f *fakeServer) handleDelete(w http.ResponseWriter, r *http.Request) {
	f.mu.Lock()
	defer f.mu.Unlock()

	a, ok := f.appliances[r.PathValue("id")]
	if !ok {
		writeNotFound(w)
		return
	}
	delete(f.appliances, r.PathValue("id"))
	writeJSON(w, http.StatusOK, &v1.ModelsApplianceApplianceGetResponseBody{Appliance: *a, IsOk: true})
}

func (f *fakeServer) handleApply(w http.ResponseWriter, r *http.Request) {
	f.mu.Lock()
	_, ok := f.appliances[r.PathValue("id")]
	f.mu.Unlock()
	if !ok {
		writeNotFound(w)
		return
	}
	writeJSON(w, http.StatusOK, &v1.ModelsApplianceApplianceApplyResponse{
		Success:    true,
		ReturnCode: 0,
		IsOk:       true,
	})
}

func (f *fakeServer) handleGetInterface(w http.ResponseWriter, r *http.Request) {
	f.mu.Lock()
	_, ok := f.appliances[r.PathValue("id")]
	f.mu.Unlock()
	if !ok {
		writeNotFound(w)
		return
	}

	iface := v1.ModelsNetworkSimpleInterface{
		Switch: v1.ModelsNetworkSimpleInterfaceSwitch{Scope: v1.ModelsNetworkSimpleInterfaceSwitchScopeUser},
	}
	iface.IPAddress.SetTo("192.168.0.1")
	iface.UserIPAddress.SetTo("192.168.0.1")

	writeJSON(w, http.StatusOK, &v1.ModelsApplianceApplianceGetInterfaceResponseBody{
		Interface: iface,
		IsOk:      true,
	})
}

func (f *fakeServer) handleGetPowerStatus(w http.ResponseWriter, r *http.Request) {
	f.mu.Lock()
	a, ok := f.appliances[r.PathValue("id")]
	f.mu.Unlock()
	if !ok {
		writeNotFound(w)
		return
	}

	status := v1.ModelsInstanceInstanceForPowerStatusDown
	if s, ok := a.Instance.Status.Get(); ok && s == v1.ModelsInstanceInstanceStatusUp {
		status = v1.ModelsInstanceInstanceForPowerStatusUp
	}
	writeJSON(w, http.StatusOK, &v1.ModelsPowerApplianceGetPowerStatusResponseBody{
		Instance: v1.ModelsInstanceInstanceForPower{Status: status},
		IsOk:     true,
	})
}

func (f *fakeServer) handlePowerOn(w http.ResponseWriter, r *http.Request) {
	f.mu.Lock()
	a, ok := f.appliances[r.PathValue("id")]
	if ok {
		a.Instance.Status.SetTo(v1.ModelsInstanceInstanceStatusUp)
	}
	f.mu.Unlock()
	if !ok {
		writeNotFound(w)
		return
	}
	writeJSON(w, http.StatusOK, &v1.ModelsPowerApplianceUpdatePowerStatusResponseBody{
		Success: v1.ModelsPowerApplianceUpdatePowerStatusResponseBodySuccess{
			Type: v1.BoolModelsPowerApplianceUpdatePowerStatusResponseBodySuccess,
			Bool: true,
		},
		IsOk: true,
	})
}

func (f *fakeServer) handlePowerOff(w http.ResponseWriter, r *http.Request) {
	f.mu.Lock()
	a, ok := f.appliances[r.PathValue("id")]
	if ok {
		a.Instance.Status.SetTo(v1.ModelsInstanceInstanceStatusDown)
	}
	f.mu.Unlock()
	if !ok {
		writeNotFound(w)
		return
	}
	writeJSON(w, http.StatusOK, &v1.ModelsPowerApplianceUpdatePowerStatusResponseBody{
		Success: v1.ModelsPowerApplianceUpdatePowerStatusResponseBodySuccess{
			Type: v1.BoolModelsPowerApplianceUpdatePowerStatusResponseBodySuccess,
			Bool: true,
		},
		IsOk: true,
	})
}

func (f *fakeServer) handleReset(w http.ResponseWriter, r *http.Request) {
	f.mu.Lock()
	_, ok := f.appliances[r.PathValue("id")]
	f.mu.Unlock()
	if !ok {
		writeNotFound(w)
		return
	}
	writeJSON(w, http.StatusOK, &v1.ModelsPowerApplianceUpdatePowerStatusResponseBody{
		Success: v1.ModelsPowerApplianceUpdatePowerStatusResponseBodySuccess{
			Type: v1.BoolModelsPowerApplianceUpdatePowerStatusResponseBodySuccess,
			Bool: true,
		},
		IsOk: true,
	})
}

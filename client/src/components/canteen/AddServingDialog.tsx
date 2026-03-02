
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Search } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";
import { useToast } from "@/hooks/use-toast";

interface AddServingDialogProps {
    isOpen: boolean;
    onClose: () => void;
    defaultDate?: string;
}

export function AddServingDialog({ isOpen, onClose, defaultDate }: AddServingDialogProps) {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [search, setSearch] = useState("");
    const debouncedSearch = useDebounce(search, 500);
    const [overridePrice, setOverridePrice] = useState(false);
    const [showResults, setShowResults] = useState(false);

    const form = useForm({
        defaultValues: {
            employeeId: "",
            date: defaultDate || new Date().toISOString().split("T")[0],
            mealType: "lunch",
            price: 0,
            note: ""
        }
    });

    const { watch, setValue, register, handleSubmit, reset } = form;
    const date = watch("date");
    const mealType = watch("mealType");

    // 1. Employee Search Query
    const { data: employees = [], isLoading: loadingEmps } = useQuery({
        queryKey: ['canteen.admin.employees', debouncedSearch],
        queryFn: async () => {
            if (!debouncedSearch || debouncedSearch.length < 2) return [];
            const res = await apiRequest("GET", `/api/canteen/admin/employees?query=${debouncedSearch}`);
            return res.json();
        },
        enabled: debouncedSearch.length >= 2
    });

    // Show results when search has results
    useEffect(() => {
        if (employees.length > 0) setShowResults(true);
    }, [employees]);

    // 2. Fetch Menu Price (Autofill)
    const { data: menuPrice } = useQuery({
        queryKey: ['canteen.menu.price', date, mealType],
        queryFn: async () => {
            const res = await apiRequest("GET", `/api/canteen/admin/menu/price?date=${date}&type=${mealType}`);
            return res.json(); // returns { price: 5000 } or { price: 0 }
        },
        enabled: !overridePrice // Only fetch if not manually overridden
    });

    // Effect: Update price when menu price changes
    useEffect(() => {
        if (menuPrice && !overridePrice) {
            setValue("price", menuPrice.price);
        }
    }, [menuPrice, overridePrice, setValue]);

    // 3. Submit Mutation
    const mutation = useMutation({
        mutationFn: async (data: any) => {
            await apiRequest("POST", "/api/canteen/serve", {
                ...data,
                source: "admin_manual"
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['canteen.admin.servings'] });
            queryClient.invalidateQueries({ queryKey: ['canteen.wallets'] }); // Update wallets
            toast({ title: "Амжилттай", description: "Хоолны бүртгэл нэмэгдлээ." });
            handleClose();
        },
        onError: (err: any) => {
            let msg = "Алдаа гарлаа";
            try {
                // Try parse JSON
                const body = JSON.parse(err.message);
                msg = body.message || msg;
            } catch (e) {
                // Maybe it's just text
                msg = err.message || "Unknown error";
            }

            // Handle explicit 409 conflict text if wrapper doesn't parse
            if (msg.includes("409")) msg = "Ажилтан тухайн өдөр аль хэдийн хоол идсэн байна.";

            toast({
                title: "Алдаа",
                description: msg,
                variant: "destructive"
            });
        }
    });

    const handleClose = () => {
        reset();
        setSearch("");
        setOverridePrice(false);
        onClose();
    };

    const selectEmployee = (emp: any) => {
        setValue("employeeId", emp.id);
        setSearch(`${emp.lastName?.charAt(0)}. ${emp.firstName} (${emp.employeeCode})`);
        setShowResults(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Гараар хоол нэмэх</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-4">

                    {/* Employee Search */}
                    <div className="space-y-2 relative">
                        <label className="text-sm font-medium">Ажилтан хайх</label>
                        <div className="relative">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Нэр эсвэл кодоор..."
                                className="pl-8"
                                value={search}
                                onChange={(e) => {
                                    setSearch(e.target.value);
                                    if (e.target.value.length < 2) setShowResults(false);
                                }}
                                onFocus={() => { if (employees.length > 0) setShowResults(true); }}
                                // Delay blur to allow click
                                onBlur={() => setTimeout(() => setShowResults(false), 200)}
                            />
                        </div>

                        {showResults && employees.length > 0 && (
                            <div className="border rounded-md max-h-40 overflow-y-auto bg-popover text-popover-foreground absolute z-50 w-full shadow-md mt-1">
                                {employees.map((emp: any) => (
                                    <div
                                        key={emp.id}
                                        className="p-2 hover:bg-accent hover:text-accent-foreground cursor-pointer text-sm"
                                        onClick={() => selectEmployee(emp)}
                                    >
                                        <span className="font-bold">{emp.employeeCode}</span> - {emp.lastName?.charAt(0)}. {emp.firstName}
                                    </div>
                                ))}
                            </div>
                        )}
                        {loadingEmps && <div className="text-xs text-muted-foreground absolute right-2 top-0">Хайж байна...</div>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Огноо</label>
                            <Input type="date" {...register("date")} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Төрөл</label>
                            <Select onValueChange={(val) => setValue("mealType", val)} defaultValue="lunch">
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="lunch">Өдөр</SelectItem>
                                    <SelectItem value="dinner">Орой</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium">Үнэ</label>
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="override"
                                    checked={overridePrice}
                                    onCheckedChange={(c) => setOverridePrice(!!c)}
                                />
                                <label htmlFor="override" className="text-xs text-muted-foreground">Гараар өөрчлөх</label>
                            </div>
                        </div>
                        <Input
                            type="number"
                            {...register("price", { valueAsNumber: true })}
                            disabled={!overridePrice}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Тайлбар (Optional)</label>
                        <Input {...register("note")} placeholder="Жишээ: Зочин" />
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={handleClose}>Болих</Button>
                        <Button type="submit" disabled={mutation.isPending}>
                            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Нэмэх
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
